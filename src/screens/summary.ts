import type { Recommendation } from '../shared/recommendation'
import type { Severity } from '../shared/rules-types'

const WEIGHTS: Record<Severity, number> = { error: 10, warning: 3, info: 1 }

export function computeScore(issues: Array<{ severity: Severity }>): number {
  const penalty = issues.reduce((acc, i) => acc + WEIGHTS[i.severity], 0)
  return Math.max(0, 100 - penalty)
}

function severityHeading(sev: Severity): string {
  return sev === 'error' ? 'Ошибки' : sev === 'warning' ? 'Предупреждения' : 'Советы'
}

export function renderMarkdownReport(params: {
  score: number
  docName: string
  recommendations: Recommendation[]
}): string {
  const { score, docName, recommendations } = params
  const counts = { error: 0, warning: 0, info: 0 }
  for (const r of recommendations) counts[r.severity] += 1

  const lines: string[] = []
  lines.push(`# Design Libs Inspector — отчёт`)
  lines.push('')
  lines.push(`Документ: «${docName}»`)
  lines.push(`Оценка: **${score} / 100**`)
  lines.push(`Ошибок: ${counts.error} · Предупреждений: ${counts.warning} · Советов: ${counts.info}`)
  lines.push('')

  let counter = 0
  for (const sev of ['error', 'warning', 'info'] as Severity[]) {
    const subset = recommendations
      .filter((r) => r.severity === sev)
      .sort((a, b) => b.priority - a.priority)
    if (!subset.length) continue
    lines.push(`## ${severityHeading(sev)}`)
    lines.push('')
    for (const r of subset) {
      counter += 1
      lines.push(`### ${counter}. ${r.title}  · P${r.priority}`)
      const stdPart = r.rationale.standard ? ` — ${r.rationale.standard}` : ''
      lines.push(`- **Правило:** ${r.rationale.ruleName} (${r.rationale.category})${stdPart}`)
      const path = r.target.path ? `  ·  ${r.target.path}` : ''
      lines.push(`- **Где:** «${r.target.nodeName}»${path}${r.target.hint ? ` — ${r.target.hint}` : ''}`)
      lines.push(`- **Что:** ${r.summary}`)
      if (r.measurements && Object.keys(r.measurements).length) {
        lines.push(
          `- **Измерения:** ` +
            Object.entries(r.measurements).map(([k, v]) => `\`${k}=${v}\``).join(', '),
        )
      }
      const expectedPart = r.fix.expected
        ? ` (нужно: ${r.fix.expected}${r.fix.actual ? `, сейчас: ${r.fix.actual}` : ''})`
        : ''
      lines.push(`- **Как исправить**${expectedPart}`)
      for (let i = 0; i < r.fix.steps.length; i++) {
        lines.push(`  ${i + 1}. ${r.fix.steps[i]}`)
      }
      if (r.examples?.good) lines.push(`- **Пример хорошо:** ${r.examples.good}`)
      if (r.examples?.bad) lines.push(`- **Пример плохо:** ${r.examples.bad}`)
      if (r.docUrl) lines.push(`- [Документация →](${r.docUrl})`)
      lines.push('')
    }
  }

  return lines.join('\n')
}

/** Компактное копирование одного fix в буфер. */
export function renderFixSnippet(r: Recommendation): string {
  const lines: string[] = []
  lines.push(`${r.rationale.ruleName} · ${r.title}`)
  lines.push(r.summary)
  if (r.fix.expected) lines.push(`→ Нужно: ${r.fix.expected}${r.fix.actual ? ` (сейчас ${r.fix.actual})` : ''}`)
  for (let i = 0; i < r.fix.steps.length; i++) lines.push(`${i + 1}. ${r.fix.steps[i]}`)
  return lines.join('\n')
}
