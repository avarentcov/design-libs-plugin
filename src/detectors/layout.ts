import type { DetectorFn, Recommendation } from './types'
import { buildRecommendation } from '../shared/recommendation'
import { byIdMap, resolveNodePath } from './utils/geometry'

/** grid-snap: координаты кратны N. */
export const gridSnap: DetectorFn = ({ nodes, rule, settings }) => {
  const out: Recommendation[] = []
  const byId = byIdMap(nodes)
  const grid = Number(rule.detector?.params?.grid ?? settings.gridSize)
  for (const n of nodes) {
    if (!n.visible || n.type === 'TEXT') continue
    if (n.parentId == null) continue
    const badX = Math.abs(n.x % grid) > 0.01
    const badY = Math.abs(n.y % grid) > 0.01
    if (!badX && !badY) continue
    out.push(
      buildRecommendation({
        rule,
        detectorId: 'grid-snap',
        origin: 'auto',
        target: { nodeId: n.id, nodeName: n.name, path: resolveNodePath(n.id, byId) },
        title: 'Элемент вне сетки',
        summary: `Позиция (${n.x}, ${n.y}) не кратна ${grid} px.`,
        fix: {
          steps: [
            `Выровняйте позицию по сетке ${grid} px.`,
            'Используйте Auto Layout — он сам держит шаги кратными выбранному gap.',
          ],
          expected: `кратно ${grid} px`,
          actual: `${n.x}, ${n.y}`,
        },
        measurements: { x: n.x, y: n.y, grid },
      }),
    )
  }
  return out
}

/** radius-consistency: ≤ 3 разных cornerRadius. */
export const radiusConsistency: DetectorFn = ({ nodes, rule }) => {
  const maxVariants = Number(rule.detector?.params?.maxVariants ?? 3)
  const radii = new Set<number>()
  for (const n of nodes) {
    if (typeof n.cornerRadius === 'number' && n.cornerRadius > 0) radii.add(n.cornerRadius)
  }
  if (radii.size <= maxVariants) return []
  const root = nodes[0]
  if (!root) return []
  const list = [...radii].sort((a, b) => a - b)
  return [
    buildRecommendation({
      rule,
      detectorId: 'radius-consistency',
      origin: 'auto',
      target: { nodeId: root.id, nodeName: root.name },
      title: 'Разнобой скруглений',
      summary: `Найдено ${radii.size} разных corner-radius: ${list.join(', ')} px.`,
      fix: {
        steps: [`Сведите к ${maxVariants} вариантам (например, 4/8/16 px).`, 'Зафиксируйте радиусы в токенах/стилях.'],
        expected: `≤ ${maxVariants}`,
        actual: String(radii.size),
      },
      measurements: { count: radii.size, max: maxVariants },
    }),
  ]
}

/** stroke-consistency: ограничение на толщины обводок. */
export const strokeConsistency: DetectorFn = ({ nodes, rule }) => {
  const max = Number(rule.detector?.params?.maxWeights ?? 3)
  const weights = new Set<number>()
  for (const n of nodes) {
    if (n.strokeWeight > 0) weights.add(Math.round(n.strokeWeight * 10) / 10)
  }
  if (weights.size <= max) return []
  const root = nodes[0]
  if (!root) return []
  return [
    buildRecommendation({
      rule,
      detectorId: 'stroke-consistency',
      origin: 'auto',
      target: { nodeId: root.id, nodeName: root.name },
      title: 'Разные толщины обводок',
      summary: `Используется ${weights.size} различных stroke-weight.`,
      fix: {
        steps: [`Сведите к ${max} толщинам.`, 'Обычно достаточно 1 px для границ и 2 px для focus/selected.'],
        expected: `≤ ${max}`,
        actual: String(weights.size),
      },
      measurements: { count: weights.size, max },
    }),
  ]
}

/** shadow-consistency: 3–6 уровней теней. */
export const shadowConsistency: DetectorFn = ({ nodes, rule }) => {
  const min = Number(rule.detector?.params?.minLevels ?? 3)
  const max = Number(rule.detector?.params?.maxLevels ?? 6)
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
  return [
    buildRecommendation({
      rule,
      detectorId: 'shadow-consistency',
      origin: 'auto',
      target: { nodeId: root.id, nodeName: root.name },
      title: 'Слишком много вариантов теней',
      summary: `Найдено ${sigs.size} уникальных drop-shadow.`,
      fix: {
        steps: [`Сведите к ${min}–${max} уровням elevation.`, 'Закрепите набор теней как стили/токены.'],
        expected: `${min}–${max}`,
        actual: String(sigs.size),
      },
      measurements: { count: sigs.size, min, max },
    }),
  ]
}
