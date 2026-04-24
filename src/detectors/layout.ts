import type { DetectorFn } from './types'
import { buildRecommendation } from '../shared/recommendation'
import type { Severity } from '../shared/rules-types'
import { byIdMap, resolveNodePath } from './utils/geometry'

/** Выбираем top-N самых частых значений из счётчика. */
function pickAllowed<T>(counts: Map<T, number>, n: number): Set<T> {
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  return new Set(sorted.slice(0, n).map(([v]) => v))
}

/** radius-consistency: находим нестандартные corner-radius на конкретных слоях. */
export const radiusConsistency: DetectorFn = ({ nodes, rule }) => {
  const maxVariants = Number(rule.detector?.params?.maxVariants ?? 2)
  const hardMax = Number(rule.detector?.params?.hardMax ?? 4)
  const byId = byIdMap(nodes)

  const counts = new Map<number, number>()
  const nodesByRadius = new Map<number, typeof nodes>()
  for (const n of nodes) {
    if (typeof n.cornerRadius !== 'number' || n.cornerRadius <= 0) continue
    const r = Math.round(n.cornerRadius * 100) / 100
    counts.set(r, (counts.get(r) ?? 0) + 1)
    const list = nodesByRadius.get(r) ?? []
    list.push(n)
    nodesByRadius.set(r, list)
  }
  if (counts.size <= maxVariants) return []

  const allowed = pickAllowed(counts, maxVariants)
  const severity: Severity = counts.size > hardMax ? 'error' : 'warning'
  const allowedLabel = [...allowed].sort((a, b) => a - b).join('/')
  const format = (r: number) => (Number.isInteger(r) ? r.toString() : r.toFixed(2))

  const out = []
  for (const [radius, ns] of nodesByRadius) {
    if (allowed.has(radius)) continue
    for (const n of ns) {
      out.push(
        buildRecommendation({
          rule,
          detectorId: 'radius-consistency',
          origin: 'auto',
          severity,
          target: { nodeId: n.id, nodeName: n.name, path: resolveNodePath(n.id, byId) },
          title: severity === 'error' ? 'Сильный разнобой скруглений' : 'Разнобой скруглений',
          summary: `Corner-radius ${format(radius)} px не входит в принятый набор (${allowedLabel}). Всего уникальных значений в макете: ${counts.size}.`,
          fix: {
            steps: [
              `Сведите к ${maxVariants} вариантам (например, ${allowedLabel || '4/8'}).`,
              'Зафиксируйте радиусы в токенах.',
            ],
            expected: `${allowedLabel || `≤ ${maxVariants}`}`,
            actual: `${format(radius)} px`,
          },
          measurements: { radius, totalVariants: counts.size, allowed: maxVariants },
        }),
      )
    }
  }
  return out
}

/** stroke-consistency: находим нестандартные толщины обводок на конкретных слоях. */
export const strokeConsistency: DetectorFn = ({ nodes, rule }) => {
  const max = Number(rule.detector?.params?.maxWeights ?? 2)
  const hardMax = Number(rule.detector?.params?.hardMax ?? 4)
  const byId = byIdMap(nodes)

  const counts = new Map<number, number>()
  const nodesByWeight = new Map<number, typeof nodes>()
  for (const n of nodes) {
    if (!(n.strokeWeight > 0)) continue
    if (!n.strokes.length) continue
    if (!n.strokes.some((s) => s.visible)) continue
    const w = Math.round(n.strokeWeight * 10) / 10
    counts.set(w, (counts.get(w) ?? 0) + 1)
    const list = nodesByWeight.get(w) ?? []
    list.push(n)
    nodesByWeight.set(w, list)
  }
  if (counts.size <= max) return []

  const allowed = pickAllowed(counts, max)
  const severity: Severity = counts.size > hardMax ? 'error' : 'warning'
  const allowedLabel = [...allowed].sort((a, b) => a - b).join('/')

  const out = []
  for (const [weight, ns] of nodesByWeight) {
    if (allowed.has(weight)) continue
    for (const n of ns) {
      out.push(
        buildRecommendation({
          rule,
          detectorId: 'stroke-consistency',
          origin: 'auto',
          severity,
          target: { nodeId: n.id, nodeName: n.name, path: resolveNodePath(n.id, byId) },
          title: severity === 'error' ? 'Слишком много обводок' : 'Разные толщины обводок',
          summary: `Stroke-weight ${weight} px не входит в принятый набор (${allowedLabel}). Всего уникальных толщин: ${counts.size}.`,
          fix: {
            steps: [
              `Сведите к ${max} толщинам (обычно: 1 px граница, 2 px focus).`,
              'Закрепите набор в токенах/стилях.',
            ],
            expected: `${allowedLabel || `≤ ${max}`}`,
            actual: `${weight} px`,
          },
          measurements: { weight, totalVariants: counts.size, allowed: max },
        }),
      )
    }
  }
  return out
}

/** shadow-consistency: находим нестандартные drop-shadow на конкретных слоях. */
export const shadowConsistency: DetectorFn = ({ nodes, rule }) => {
  const min = Number(rule.detector?.params?.minLevels ?? 2)
  const max = Number(rule.detector?.params?.maxLevels ?? 4)
  const hardMax = Number(rule.detector?.params?.hardMax ?? 6)
  const byId = byIdMap(nodes)

  const counts = new Map<string, number>()
  const nodesBySig = new Map<string, typeof nodes>()
  const sigFormat = new Map<string, string>()
  for (const n of nodes) {
    for (const e of n.effects) {
      if (e.type !== 'DROP_SHADOW' || !e.visible) continue
      const sig = `${e.radius ?? 0}|${e.offset?.y ?? 0}|${e.spread ?? 0}`
      counts.set(sig, (counts.get(sig) ?? 0) + 1)
      const list = nodesBySig.get(sig) ?? []
      list.push(n)
      nodesBySig.set(sig, list)
      if (!sigFormat.has(sig)) sigFormat.set(sig, `y=${e.offset?.y ?? 0} blur=${e.radius ?? 0} spread=${e.spread ?? 0}`)
    }
  }
  if (counts.size <= max) return []

  const allowed = pickAllowed(counts, max)
  const severity: Severity = counts.size > hardMax ? 'error' : 'warning'

  const out = []
  for (const [sig, ns] of nodesBySig) {
    if (allowed.has(sig)) continue
    for (const n of ns) {
      out.push(
        buildRecommendation({
          rule,
          detectorId: 'shadow-consistency',
          origin: 'auto',
          severity,
          target: { nodeId: n.id, nodeName: n.name, path: resolveNodePath(n.id, byId) },
          title: severity === 'error' ? 'Слишком много уровней теней' : 'Разнобой теней',
          summary: `Тень ${sigFormat.get(sig)} не входит в принятый набор. Всего уникальных теней в макете: ${counts.size}.`,
          fix: {
            steps: [
              `Сведите к ${min}–${max} уровням elevation.`,
              'Закрепите набор теней как стили/токены.',
            ],
            expected: `${min}–${max} уровней`,
            actual: `${counts.size}`,
          },
          measurements: { totalVariants: counts.size, min, max },
        }),
      )
    }
  }
  return out
}
