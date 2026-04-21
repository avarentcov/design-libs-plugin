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

export const DEFAULT_MODEL: ClaudeModel = 'claude-sonnet-4-5'

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
  nodeHint?: string
  fix: AiIssueFix
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
  signal?: AbortSignal
}

function buildPrompt(rules: FigmaRule[]): string {
  const compact = rules.slice(0, MAX_RULES_IN_PROMPT).map((r) => ({
    id: r.id,
    name: r.nameRu,
    severity: r.severity,
    summary: r.summary,
    antiPattern: r.antiPattern,
  }))
  return [
    'Ты — строгий UX/UI-аудитор. Оцени приложенный скриншот макета по списку правил и верни результат, вызвав инструмент `report_issues`.',
    '',
    'Правила вывода:',
    '- Находи только реальные нарушения, видимые на скриншоте. Не выдумывай.',
    '- `ruleId` строго из списка ниже.',
    '- `title` — 3–6 слов.',
    '- `summary` — одно предложение.',
    '- `fix.steps` — 1–3 шага, глагол в повелительном наклонении.',
    '- Не дублируй summary правила — общий контекст придёт из каталога автоматически.',
    '- Пиши по-русски. «Ёлочки» и тире —.',
    '',
    'Правила:',
    '```json',
    JSON.stringify(compact, null, 2),
    '```',
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
  input?: { issues?: Array<Partial<AiIssue> & { fix?: Partial<AiIssueFix> }>; summary?: string }
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
      'x-api-key': apiKey,
      'anthropic-version': API_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
    signal,
  })
}

export async function runVisionAudit(params: RunVisionAuditParams): Promise<AiAuditResult> {
  const { apiKey, pngBase64, rules, signal } = params
  const model = params.model ?? DEFAULT_MODEL

  if (!apiKey) throw new Error('Не задан API-ключ Anthropic.')
  if (!pngBase64) throw new Error('Не передан PNG-скриншот.')
  if (approxBase64Bytes(pngBase64) > MAX_IMAGE_BYTES) {
    throw new Error('Скриншот больше 1 МБ. Уменьшите масштаб экспорта до 1 и попробуйте снова.')
  }

  const prompt = buildPrompt(rules)
  const body = {
    model,
    max_tokens: 2048,
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

  let attempt = 0
  let lastError: Error | null = null
  while (attempt < 2) {
    attempt += 1
    let res: Response
    try {
      res = await callApi(body, apiKey, signal)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < 2) { await sleep(500, signal); continue }
      throw lastError
    }

    if (res.status === 429 && attempt < 2) {
      await sleep(1200, signal)
      continue
    }

    const json = (await res.json().catch(() => ({}))) as AnthropicResponse

    if (!res.ok) {
      const message = json.error?.message ?? `HTTP ${res.status}`
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
      issues.push({
        ruleId: raw.ruleId,
        severity: (['error', 'warning', 'info'] as Severity[]).includes(raw.severity as Severity)
          ? (raw.severity as Severity)
          : 'info',
        title,
        summary,
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
