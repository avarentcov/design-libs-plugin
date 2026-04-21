import type { DetectorFn, Recommendation } from './types'
import { buildRecommendation } from '../shared/recommendation'
import type { Severity } from '../shared/rules-types'
import { byIdMap, rectsOverlap, resolveNodePath } from './utils/geometry'
import { contrastRatio, firstVisibleSolid, flatten, resolveBackground } from './utils/color'

function isField(name: string): boolean {
  return /input|field|textarea|select|search|email|password|combobox/i.test(name)
}

/** missing-label: без подписи — ошибка. */
export const missingLabel: DetectorFn = ({ nodes, rule }) => {
  const out: Recommendation[] = []
  const byId = byIdMap(nodes)
  for (const n of nodes) {
    if (n.type === 'TEXT') continue
    if (!isField(n.name) || !n.visible) continue
    const parent = n.parentId ? byId.get(n.parentId) : null
    const siblings = parent?.childrenIds.map((id) => byId.get(id)).filter(Boolean) as typeof nodes
    const hasLabel = siblings?.some(
      (s) => s !== n && s.type === 'TEXT' && s.visible && (s.absoluteY + s.height <= n.absoluteY + 8 || rectsOverlap(n, s, 48)),
    )
    if (hasLabel) continue
    out.push(
      buildRecommendation({
        rule,
        detectorId: 'missing-label',
        origin: 'auto',
        target: { nodeId: n.id, nodeName: n.name, path: resolveNodePath(n.id, byId) },
        title: 'Поле без подписи',
        summary: `У «${n.name}» нет видимой текстовой метки.`,
        standard: 'WCAG 2.2 §1.3.1',
        fix: {
          steps: [
            'Добавьте текстовую подпись-лейбл сверху поля.',
            'В коде — `aria-label` или `<label for>` для скринридеров.',
            'Плейсхолдер не заменяет лейбл.',
          ],
        },
      }),
    )
  }
  return out
}

/** disabled-visible: градиент по контрасту. */
export const disabledVisible: DetectorFn = ({ nodes, rule }) => {
  const out: Recommendation[] = []
  const byId = byIdMap(nodes)
  const minContrast = Number(rule.detector?.params?.minContrast ?? 4.5)
  const softMin = Number(rule.detector?.params?.softMin ?? 3)
  for (const n of nodes) {
    if (!/disabled|inactive/i.test(n.name)) continue
    const fg = firstVisibleSolid(n.fills)
    if (!fg) continue
    const bg = resolveBackground(n, byId, { r: 1, g: 1, b: 1, a: 1 })
    const ratio = contrastRatio(flatten(fg, bg), bg)
    let severity: Severity | null = null
    if (ratio < softMin) severity = 'error'
    else if (ratio < minContrast) severity = 'warning'
    if (!severity) continue
    out.push(
      buildRecommendation({
        rule,
        detectorId: 'disabled-visible',
        origin: 'auto',
        severity,
        target: { nodeId: n.id, nodeName: n.name, path: resolveNodePath(n.id, byId) },
        title: severity === 'error' ? 'Disabled сливается с фоном' : 'Disabled со слабым контрастом',
        summary: `Контраст ${ratio.toFixed(2)}:1 — элемент ${severity === 'error' ? 'почти не виден' : 'читается с трудом'}.`,
        fix: {
          steps: [
            `Сохраняйте контраст ≥ ${severity === 'error' ? softMin : minContrast}:1 для disabled.`,
            'Снижайте насыщенность, а не opacity до нечитаемого.',
          ],
          expected: `≥ ${severity === 'error' ? softMin : minContrast}:1`,
          actual: `${ratio.toFixed(2)}:1`,
        },
        measurements: { ratio: Number(ratio.toFixed(2)) },
      }),
    )
  }
  return out
}

/** focus-visible. */
export const focusVisible: DetectorFn = ({ nodes, rule }) => {
  const hasAnyFocus = nodes.some((n) => /focus|focused/i.test(n.name))
  const hasInteractive = nodes.some((n) => /btn|button|input|field|tab/i.test(n.name))
  if (!hasInteractive || hasAnyFocus) return []
  const root = nodes[0]
  if (!root) return []
  return [
    buildRecommendation({
      rule,
      detectorId: 'focus-visible',
      origin: 'auto',
      target: { nodeId: root.id, nodeName: root.name },
      title: 'Нет focus-состояний',
      summary: 'В макете есть интерактивные элементы, но вариантов :focus не нарисовано.',
      standard: 'WCAG 2.2 §2.4.7',
      fix: {
        steps: [
          'Добавьте варианты компонентов с focus-ring (обводка 2 px).',
          'Контрастный цвет, отличающийся от hover.',
          'Проверьте навигацию Tab клавиатурой.',
        ],
      },
    }),
  ]
}
