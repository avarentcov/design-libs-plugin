import type { DetectorFn, Recommendation } from './types'
import { buildRecommendation } from '../shared/recommendation'
import type { Severity } from '../shared/rules-types'
import { byIdMap, isTappable, resolveNodePath } from './utils/geometry'

/**
 * choice-count (закон Хика) — градиент:
 *   > hardMax → error (слишком много — парализует выбор)
 *   > max → warning (нарушение 7±2)
 *   > soft → info (на верхней границе)
 */
export const choiceCount: DetectorFn = ({ nodes, rule }) => {
  const out: Recommendation[] = []
  const soft = Number(rule.detector?.params?.soft ?? 5)
  const max = Number(rule.detector?.params?.max ?? 7)
  const hardMax = Number(rule.detector?.params?.hardMax ?? 9)
  const byId = byIdMap(nodes)
  const parentToButtons = new Map<string, string[]>()
  for (const n of nodes) {
    if (!isTappable(n) || !n.parentId) continue
    const arr = parentToButtons.get(n.parentId) ?? []
    arr.push(n.id)
    parentToButtons.set(n.parentId, arr)
  }
  for (const [parentId, btnIds] of parentToButtons) {
    const count = btnIds.length
    if (count <= soft) continue
    const parent = byId.get(parentId)
    if (!parent) continue
    let severity: Severity
    if (count > hardMax) severity = 'error'
    else if (count > max) severity = 'warning'
    else severity = 'info'
    out.push(
      buildRecommendation({
        rule,
        detectorId: 'choice-count',
        origin: 'auto',
        severity,
        target: { nodeId: parent.id, nodeName: parent.name, path: resolveNodePath(parent.id, byId) },
        title: severity === 'error' ? 'Слишком много действий' : 'Группа плотно заполнена',
        summary: `В «${parent.name}» ${count} кнопок.`,
        standard: 'Закон Хика',
        fix: {
          steps: [
            `Оставьте ${severity === 'info' ? soft : max}${severity === 'warning' ? '±2' : ''} основных действий.`,
            'Сгруппируйте вторичные в меню «Ещё» или overflow.',
            'Разбейте задачу на последовательные шаги.',
          ],
          expected: `≤ ${max}`,
          actual: String(count),
        },
        measurements: { count, soft, max, hardMax },
      }),
    )
  }
  return out
}
