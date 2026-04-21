/**
 * Серверный AI-аудит через наш прокси на v0-design-libs (Anthropic Claude под капотом).
 * Ключа у пользователя нет — жмём через серверный ANTHROPIC_API_KEY, под rate-limit 20/час по IP.
 */
import type { FigmaRule } from '../shared/rules-types'
import type { AiAuditResult, AiIssue, AiIssueFix, ClaudeModel } from './claude'

export const DEFAULT_SERVER_URL = 'https://design-libs.vercel.app/api/ai-audit/v1'

export interface RunServerAuditParams {
  serverUrl?: string
  model?: ClaudeModel
  pngBase64: string
  rules: FigmaRule[]
  signal?: AbortSignal
}

interface ProxyResponse {
  issues?: Array<Partial<AiIssue> & { fix?: Partial<AiIssueFix> }>
  summary?: string | null
  model?: string
  usage?: { inputTokens: number; outputTokens: number } | null
  error?: string
  message?: string
  retryAfter?: number
}

export class ServerAuditError extends Error {
  readonly code: string
  readonly retryAfter?: number
  constructor(code: string, message: string, retryAfter?: number) {
    super(message)
    this.code = code
    this.retryAfter = retryAfter
  }
}

export async function runServerVisionAudit(params: RunServerAuditParams): Promise<AiAuditResult> {
  const { pngBase64, rules, model, signal } = params
  const url = params.serverUrl || DEFAULT_SERVER_URL

  if (!pngBase64) throw new ServerAuditError('missing_image', 'Не передан PNG-скриншот.')
  if (rules.length === 0) throw new ServerAuditError('missing_rules', 'Нет AI-правил для проверки.')

  const compact = rules.slice(0, 40).map((r) => ({
    id: r.id,
    name: r.nameRu,
    severity: r.severity,
    summary: r.summary,
    antiPattern: r.antiPattern,
  }))

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pngBase64, rules: compact, model }),
      signal,
    })
  } catch (err) {
    throw new ServerAuditError('network', `Сеть: ${err instanceof Error ? err.message : 'unknown'}`)
  }

  const json = (await res.json().catch(() => ({}))) as ProxyResponse

  if (!res.ok) {
    const code = json.error ?? `http_${res.status}`
    const message = json.message ?? `HTTP ${res.status}`
    throw new ServerAuditError(code, message, json.retryAfter)
  }

  const raw = Array.isArray(json.issues) ? json.issues : []
  const knownRuleIds = new Set(rules.map((r) => r.id))
  const issues: AiIssue[] = []
  for (const r of raw) {
    if (!r || typeof r.ruleId !== 'string' || !knownRuleIds.has(r.ruleId)) continue
    const title = String(r.title ?? '').trim()
    const summary = String(r.summary ?? '').trim()
    if (!title || !summary) continue
    const steps = Array.isArray(r.fix?.steps)
      ? r.fix!.steps.map((s) => String(s).trim()).filter(Boolean)
      : []
    if (steps.length === 0) continue
    issues.push({
      ruleId: r.ruleId,
      severity: (['error', 'warning', 'info'] as const).includes(r.severity as never)
        ? (r.severity as AiIssue['severity'])
        : 'info',
      title,
      summary,
      nodeHint: r.nodeHint ? String(r.nodeHint) : undefined,
      fix: { steps, expected: r.fix?.expected ? String(r.fix.expected) : undefined },
    })
  }

  return {
    issues,
    summary: json.summary ?? undefined,
    model: (json.model as ClaudeModel) ?? (model ?? ('claude-sonnet-4-5' as ClaudeModel)),
    usage: json.usage ?? undefined,
  }
}
