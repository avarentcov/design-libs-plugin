/**
 * Структурированная рекомендация — единая модель для auto и AI.
 * Заменяет плоский Issue. Прокидывается во все слои: UI, MD-отчёт, игноры.
 */
import type { DetectorId, FigmaRule, Severity } from './rules-types'

export interface RecommendationTarget {
  nodeId: string
  nodeName: string
  path?: string
  hint?: string
}

export interface RecommendationRationale {
  ruleName: string
  category: string
  why: string
  standard?: string
}

export interface RecommendationFix {
  steps: string[]
  expected?: string
  actual?: string
}

export interface RecommendationExamples {
  good?: string
  bad?: string
}

export interface Recommendation {
  id: string
  ruleId: string
  detectorId?: DetectorId
  origin: 'auto' | 'ai'
  severity: Severity
  priority: number

  title: string
  summary: string
  measurements?: Record<string, string | number | boolean>

  target: RecommendationTarget
  rationale: RecommendationRationale
  fix: RecommendationFix
  examples?: RecommendationExamples

  docUrl: string
}

const SEVERITY_WEIGHT: Record<Severity, number> = {
  error: 5,
  warning: 3,
  info: 1,
}

export function computePriority(severity: Severity, impact: number): number {
  const weight = SEVERITY_WEIGHT[severity]
  const clampedImpact = Math.max(1, Math.min(5, impact))
  const raw = Math.round((weight * clampedImpact) / 5)
  return Math.max(1, Math.min(5, raw))
}

/** Детерминированный хэш строки → короткий буквенно-цифровой id. */
function shortHash(input: string): string {
  let h = 5381
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0
  return Math.abs(h).toString(36).slice(0, 6)
}

export interface BuildRecommendationInput {
  rule: FigmaRule
  detectorId?: DetectorId
  origin: 'auto' | 'ai'
  severity?: Severity
  target: RecommendationTarget
  title: string
  summary: string
  fix: RecommendationFix
  measurements?: Record<string, string | number | boolean>
  /** Переопределить стандарт, если детектор знает точнее правила. */
  standard?: string
  /** Переопределить примеры (по умолчанию — из rule.example/antiPattern). */
  examples?: RecommendationExamples
}

export function buildRecommendation(input: BuildRecommendationInput): Recommendation {
  const severity = input.severity ?? input.rule.severity
  const priority = computePriority(severity, input.rule.impact)
  const hashBase = [
    input.rule.id,
    input.target.nodeId || input.target.hint || '',
    input.summary,
    JSON.stringify(input.measurements ?? {}),
  ].join('|')
  const id = `${input.rule.id}::${input.target.nodeId || 'unknown'}::${shortHash(hashBase)}`

  const defaultExamples: RecommendationExamples | undefined =
    input.rule.example || input.rule.antiPattern
      ? { good: input.rule.example, bad: input.rule.antiPattern }
      : undefined

  // Если детектор не задал fix.steps — берём application из каталога (до 4 шагов).
  const fixSteps = input.fix.steps.length > 0
    ? input.fix.steps
    : (input.rule.application ?? []).slice(0, 4)

  return {
    id,
    ruleId: input.rule.id,
    detectorId: input.detectorId,
    origin: input.origin,
    severity,
    priority,
    title: input.title,
    summary: input.summary,
    measurements: input.measurements,
    target: input.target,
    rationale: {
      ruleName: input.rule.nameRu,
      category: input.rule.category,
      why: input.rule.summary,
      standard: input.standard,
    },
    fix: {
      steps: fixSteps,
      expected: input.fix.expected,
      actual: input.fix.actual,
    },
    examples: input.examples ?? defaultExamples,
    docUrl: input.rule.docUrl,
  }
}
