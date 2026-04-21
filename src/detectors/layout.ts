import type { DetectorFn } from './types'
import { buildRecommendation } from '../shared/recommendation'
import type { Severity } from '../shared/rules-types'

/** radius-consistency: градиент. */
export const radiusConsistency: DetectorFn = ({ nodes, rule }) => {
  const maxVariants = Number(rule.detector?.params?.maxVariants ?? 2)
  const hardMax = Number(rule.detector?.params?.hardMax ?? 4)
  const radii = new Set<number>()
  for (const n of nodes) {
    if (typeof n.cornerRadius === 'number' && n.cornerRadius > 0) radii.add(n.cornerRadius)
  }
  if (radii.size <= maxVariants) return []
  const root = nodes[0]
  if (!root) return []
  const severity: Severity = radii.size > hardMax ? 'error' : 'warning'
  const list = [...radii].sort((a, b) => a - b)
  return [
    buildRecommendation({
      rule,
      detectorId: 'radius-consistency',
      origin: 'auto',
      severity,
      target: { nodeId: root.id, nodeName: root.name },
      title: severity === 'error' ? 'Сильный разнобой скруглений' : 'Разнобой скруглений',
      summary: `Найдено ${radii.size} разных corner-radius: ${list.join(', ')} px.`,
      fix: {
        steps: [`Сведите к ${maxVariants} вариантам (например, 4/8 или 4/8/16 px).`, 'Зафиксируйте радиусы в токенах.'],
        expected: `≤ ${maxVariants}`,
        actual: String(radii.size),
      },
      measurements: { count: radii.size, max: maxVariants, hardMax },
    }),
  ]
}

/** stroke-consistency: градиент. */
export const strokeConsistency: DetectorFn = ({ nodes, rule }) => {
  const max = Number(rule.detector?.params?.maxWeights ?? 2)
  const hardMax = Number(rule.detector?.params?.hardMax ?? 4)
  const weights = new Set<number>()
  for (const n of nodes) {
    if (n.strokeWeight > 0) weights.add(Math.round(n.strokeWeight * 10) / 10)
  }
  if (weights.size <= max) return []
  const root = nodes[0]
  if (!root) return []
  const severity: Severity = weights.size > hardMax ? 'error' : 'warning'
  return [
    buildRecommendation({
      rule,
      detectorId: 'stroke-consistency',
      origin: 'auto',
      severity,
      target: { nodeId: root.id, nodeName: root.name },
      title: severity === 'error' ? 'Слишком много обводок' : 'Разные толщины обводок',
      summary: `Используется ${weights.size} различных stroke-weight.`,
      fix: {
        steps: [`Сведите к ${max} толщинам.`, 'Обычно: 1 px для границ и 2 px для focus/selected.'],
        expected: `≤ ${max}`,
        actual: String(weights.size),
      },
      measurements: { count: weights.size, max, hardMax },
    }),
  ]
}

/** shadow-consistency: градиент. */
export const shadowConsistency: DetectorFn = ({ nodes, rule }) => {
  const min = Number(rule.detector?.params?.minLevels ?? 2)
  const max = Number(rule.detector?.params?.maxLevels ?? 4)
  const hardMax = Number(rule.detector?.params?.hardMax ?? 6)
  const sigs = new Set<string>()
  for (const n of nodes) {
    for (const e of n.effects) {
      if (e.type !== 'DROP_SHADOW' || !e.visible) continue
      sigs.add(`${e.radius ?? 0}|${e.offset?.y ?? 0}|${e.spread ?? 0}`)
    }
  }
  if (sigs.size <= max) return []
  const root = nodes[0]
  if (!root) return []
  const severity: Severity = sigs.size > hardMax ? 'error' : 'warning'
  return [
    buildRecommendation({
      rule,
      detectorId: 'shadow-consistency',
      origin: 'auto',
      severity,
      target: { nodeId: root.id, nodeName: root.name },
      title: severity === 'error' ? 'Слишком много уровней теней' : 'Разнобой теней',
      summary: `Найдено ${sigs.size} уникальных drop-shadow.`,
      fix: {
        steps: [`Сведите к ${min}–${max} уровням elevation.`, 'Закрепите набор теней как стили/токены.'],
        expected: `${min}–${max}`,
        actual: String(sigs.size),
      },
      measurements: { count: sigs.size, min, max, hardMax },
    }),
  ]
}
