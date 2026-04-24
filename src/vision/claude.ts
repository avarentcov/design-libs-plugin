/**
 * Клиент Anthropic Claude Vision — BYOK-режим в плагине.
 * Использует tool-use для гарантированного структурированного ответа.
 */
import type { FigmaRule, Severity } from '../shared/rules-types'
import { REPORT_ISSUES_TOOL } from './tool-schema'

export type ClaudeModel =
  | 'claude-haiku-4-5'
  | 'claude-sonnet-4-5'
  | 'claude-sonnet-4-6'
  | 'claude-opus-4-5'
  | 'claude-opus-4-7'

export const DEFAULT_MODEL: ClaudeModel = 'claude-opus-4-7'
/** Бюджет extended-thinking для Opus (deep research). 0 = выключено. */
export const THINKING_BUDGET_TOKENS = 8000
/** Размер батча для пачечного прогона — модель теряет фокус на > 35 правилах. */
export const BATCH_SIZE = 35

const API_URL = 'https://api.anthropic.com/v1/messages'
const API_VERSION = '2023-06-01'
const MAX_IMAGE_BYTES = 1_000_000
const MAX_RULES_IN_PROMPT = 40

export interface AiIssueFix {
  steps: string[]
  expected?: string
}

export interface AiIssue {
  ruleId: string
  severity: Severity
  title: string
  summary: string
  nodeId?: string
  nodeHint?: string
  fix: AiIssueFix
}

/** Компактная запись слоя для каталога, который отдаём модели. */
export interface AiNodeRef {
  id: string
  name: string
  type: string
  text?: string
}

export interface AiAuditResult {
  issues: AiIssue[]
  summary?: string
  model: ClaudeModel
  usage?: { inputTokens: number; outputTokens: number }
}

export interface RunVisionAuditParams {
  apiKey: string
  model?: ClaudeModel
  pngBase64: string
  rules: FigmaRule[]
  /**
   * Компактный каталог слоёв выделенного фрейма: плоский список с id/именами/типами
   * и фрагментами текста. Модель обязана вернуть `nodeId` из этого каталога — это
   * единственный способ точно подсветить слой, к которому относится замечание.
   * Если каталог не передан, модель вернёт только `nodeHint`.
   */
  nodes?: AiNodeRef[]
  /** id корневого слоя (обычно сам выделенный фрейм) — модель не должна ссылаться на него. */
  rootNodeId?: string
  signal?: AbortSignal
}

/** Максимум нод в каталоге, который уходит модели. Выше — токен-бюджет. */
const MAX_NODES_IN_PROMPT = 200

function buildPrompt(rules: FigmaRule[], nodes: AiNodeRef[], rootNodeId?: string): string {
  const compact = rules.slice(0, MAX_RULES_IN_PROMPT).map((r) => ({
    id: r.id,
    name: r.nameRu,
    severity: r.severity,
    summary: r.summary,
    antiPattern: r.antiPattern,
  }))
  const nodeCatalog = nodes.slice(0, MAX_NODES_IN_PROMPT).map((n) => {
    const o: { id: string; name: string; type: string; text?: string } = {
      id: n.id, name: n.name, type: n.type,
    }
    if (n.text) o.text = n.text
    return o
  })
  const hasCatalog = nodeCatalog.length > 0
  return [
    'Ты — экспертный UX/UI-аудитор мирового уровня. Выступаешь в роли внешнего консультанта для продуктовой команды.',
    '',
    'Подход (важно):',
    '- Думай глубоко. По каждому правилу: есть ли на скриншоте конкретные визуальные свидетельства нарушения? Если сомнения — пропусти, не галлюцинируй.',
    '- Не спеши. Лучше меньше, но точных замечаний, чем много шума.',
    '- Приоритизируй. Выбирай топ-3 нарушения на категорию правил — самые явные и влияющие на UX.',
    '- Если одна и та же проблема покрывается несколькими правилами — пиши только по самому близкому по смыслу.',
    '',
    'Формат каждого issue:',
    '- `ruleId` — строго из списка ниже.',
    '- `title` — 3–6 слов, суть нарушения на русском.',
    '- `summary` — одно предложение с конкретикой: что именно не так и почему это проблема.',
    hasCatalog
      ? '- `nodeId` — **обязательно**. Строго одно из значений поля `id` из каталога `nodes` ниже. Выбирай самый узкий подходящий слой (кнопку, текст, иконку), а не корневой фрейм. Если подходящего слоя в каталоге нет — не выдавай это замечание.'
      : '- `nodeId` — если знаешь id конкретного слоя, укажи; иначе опусти.',
    '- `nodeHint` — резервная текстовая подсказка (имя слоя или видимый текст) на случай, если nodeId не получится использовать.',
    '- `fix.steps` — 1–3 шага, глагол в повелительном наклонении.',
    '- Не дублируй summary правила.',
    '- Пиши по-русски. «Ёлочки» и тире —.',
    '',
    'Правила для проверки:',
    '```json',
    JSON.stringify(compact, null, 2),
    '```',
    ...(hasCatalog
      ? [
          '',
          rootNodeId
            ? `Каталог слоёв внутри выделенного фрейма (корневой слой "${rootNodeId}" не используй — выбирай дочерние):`
            : 'Каталог слоёв внутри выделенного фрейма:',
          '```json',
          JSON.stringify(nodeCatalog, null, 2),
          '```',
        ]
      : []),
  ].join('\n')
}

function approxBase64Bytes(b64: string): number {
  return Math.floor((b64.length * 3) / 4)
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      reject(new DOMException('aborted', 'AbortError'))
    }, { once: true })
  })
}

interface AnthropicContentBlock {
  type: string
  name?: string
  input?: { issues?: Array<Partial<AiIssue> & { nodeId?: string; fix?: Partial<AiIssueFix> }>; summary?: string }
  text?: string
}

interface AnthropicResponse {
  content?: AnthropicContentBlock[]
  stop_reason?: string
  usage?: { input_tokens: number; output_tokens: number }
  error?: { type: string; message: string }
}

async function callApi(body: object, apiKey: string, signal?: AbortSignal): Promise<Response> {
  return fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey.trim().replace(/[^\x21-\x7E]/g, ''),
      'anthropic-version': API_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
    signal,
  })
}

export async function runVisionAudit(params: RunVisionAuditParams): Promise<AiAuditResult> {
  const { apiKey, pngBase64, rules, signal, nodes = [], rootNodeId } = params
  const model = params.model ?? DEFAULT_MODEL

  if (!apiKey) throw new Error('Не задан API-ключ Anthropic.')
  // Чистим ключ: в HTTP-заголовке допустимы только ASCII/Latin-1. Невидимые юникод-
  // символы (NBSP, пробелы-кавычки из автозамены) ломают fetch с криптической
  // ошибкой «non ISO-8859-1 code point».
  const cleanKey = apiKey.trim().replace(/[^\x21-\x7E]/g, '')
  if (!cleanKey) throw new Error('API-ключ содержит только невалидные символы.')
  if (cleanKey !== apiKey.trim()) {
    console.warn('[claude] API-ключ очищен от не-ASCII символов')
  }
  if (!pngBase64) throw new Error('Не передан PNG-скриншот.')
  if (approxBase64Bytes(pngBase64) > MAX_IMAGE_BYTES) {
    throw new Error('Скриншот больше 1 МБ. Уменьшите масштаб экспорта до 1 и попробуйте снова.')
  }

  const prompt = buildPrompt(rules, nodes, rootNodeId)
  const knownNodeIds = new Set(nodes.map((n) => n.id))
  // Extended thinking пытаемся включить для всех моделей Claude 4.x.
  // Если API скажет, что модель не поддерживает, сработает фолбэк ниже.
  const buildBody = (withThinking: boolean): Record<string, unknown> => {
    const body: Record<string, unknown> = {
      model,
      max_tokens: withThinking ? 8192 : 4096,
      tools: [REPORT_ISSUES_TOOL],
      tool_choice: { type: 'tool', name: REPORT_ISSUES_TOOL.name },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: pngBase64 } },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }
    if (withThinking && THINKING_BUDGET_TOKENS > 0) {
      body.thinking = { type: 'enabled', budget_tokens: THINKING_BUDGET_TOKENS }
    }
    return body
  }
  let thinkingActive = THINKING_BUDGET_TOKENS > 0
  let body = buildBody(thinkingActive)

  let attempt = 0
  let lastError: Error | null = null
  while (attempt < 3) {
    attempt += 1
    let res: Response
    try {
      res = await callApi(body, apiKey, signal)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < 3) { await sleep(500, signal); continue }
      throw lastError
    }

    if (res.status === 429 && attempt < 3) {
      await sleep(1200, signal)
      continue
    }

    const json = (await res.json().catch(() => ({}))) as AnthropicResponse

    if (!res.ok) {
      const message = json.error?.message ?? `HTTP ${res.status}`
      // Graceful fallback: модель не поддерживает extended thinking —
      // повторяем без него.
      if (
        thinkingActive &&
        /thinking/i.test(message) &&
        attempt < 3
      ) {
        thinkingActive = false
        body = buildBody(false)
        continue
      }
      throw new Error(`Anthropic API: ${message}`)
    }

    const toolBlock = json.content?.find((c) => c.type === 'tool_use' && c.name === REPORT_ISSUES_TOOL.name)
    if (!toolBlock?.input) {
      throw new Error('Модель не вызвала инструмент report_issues — ответ отброшен.')
    }

    const rawIssues = Array.isArray(toolBlock.input.issues) ? toolBlock.input.issues : []
    const knownRuleIds = new Set(rules.map((r) => r.id))
    const issues: AiIssue[] = []
    for (const raw of rawIssues) {
      if (!raw || typeof raw.ruleId !== 'string' || !knownRuleIds.has(raw.ruleId)) continue
      const title = String(raw.title ?? '').trim()
      const summary = String(raw.summary ?? '').trim()
      if (!title || !summary) continue
      const steps = Array.isArray(raw.fix?.steps)
        ? raw.fix!.steps.map((s) => String(s).trim()).filter(Boolean)
        : []
      if (steps.length === 0) continue
      // nodeId принимаем только если он есть в каталоге, который мы отдали
      // модели. Иначе отбрасываем — фолбэк сработает по nodeHint в UI.
      let nodeId: string | undefined
      if (raw.nodeId && typeof raw.nodeId === 'string') {
        const candidate = raw.nodeId.trim()
        if (candidate && candidate !== rootNodeId && (knownNodeIds.size === 0 || knownNodeIds.has(candidate))) {
          nodeId = candidate
        }
      }
      issues.push({
        ruleId: raw.ruleId,
        severity: (['error', 'warning', 'info'] as Severity[]).includes(raw.severity as Severity)
          ? (raw.severity as Severity)
          : 'info',
        title,
        summary,
        nodeId,
        nodeHint: raw.nodeHint ? String(raw.nodeHint) : undefined,
        fix: { steps, expected: raw.fix?.expected ? String(raw.fix.expected) : undefined },
      })
    }

    return {
      issues,
      summary: toolBlock.input.summary,
      model,
      usage: json.usage
        ? { inputTokens: json.usage.input_tokens, outputTokens: json.usage.output_tokens }
        : undefined,
    }
  }

  throw lastError ?? new Error('Не удалось вызвать Anthropic API.')
}

/**
 * Пачечный прогон vision-аудита. Делит правила на батчи по `BATCH_SIZE`,
 * группируя по категории (чтобы модель была в контексте одной темы).
 * Запускает батчи параллельно (Promise.allSettled) — один упавший батч не
 * валит весь прогон.
 *
 * Прогресс сообщается через `onProgress(done, total)`.
 */
export interface RunBatchedParams extends RunVisionAuditParams {
  onProgress?: (done: number, total: number) => void
}

export async function runVisionAuditBatched(params: RunBatchedParams): Promise<AiAuditResult> {
  const { rules, onProgress, ...rest } = params
  // Сортируем по категории, чтобы соседние правила попадали в один батч.
  const sorted = [...rules].sort((a, b) => (a.category ?? '').localeCompare(b.category ?? ''))
  const batches: FigmaRule[][] = []
  for (let i = 0; i < sorted.length; i += BATCH_SIZE) {
    batches.push(sorted.slice(i, i + BATCH_SIZE))
  }
  if (batches.length === 0) {
    return { issues: [], model: params.model ?? DEFAULT_MODEL }
  }
  onProgress?.(0, batches.length)

  let done = 0
  const results = await Promise.allSettled(
    batches.map((batch) =>
      runVisionAudit({ ...rest, rules: batch }).finally(() => {
        done += 1
        onProgress?.(done, batches.length)
      }),
    ),
  )

  const issues: AiIssue[] = []
  let inputTokens = 0
  let outputTokens = 0
  let model: ClaudeModel = params.model ?? DEFAULT_MODEL
  const failures: string[] = []
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    if (r.status === 'fulfilled') {
      issues.push(...r.value.issues)
      if (r.value.usage) {
        inputTokens += r.value.usage.inputTokens
        outputTokens += r.value.usage.outputTokens
      }
      model = r.value.model
    } else {
      failures.push(`Батч ${i + 1}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`)
    }
  }

  // Если все батчи упали — пробрасываем первую ошибку.
  if (failures.length === batches.length) {
    throw new Error(failures[0])
  }

  return {
    issues,
    model,
    usage: inputTokens ? { inputTokens, outputTokens } : undefined,
    summary: failures.length > 0 ? `⚠ ${failures.length} из ${batches.length} батчей не ответили` : undefined,
  }
}
