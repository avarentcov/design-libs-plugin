import type { DetectorFn, Recommendation } from './types'
import { buildRecommendation } from '../shared/recommendation'
import { byIdMap, isTappable, resolveNodePath } from './utils/geometry'

/** choice-count (закон Хика): ≤ 7±2 действий в одной группе. */
export const choiceCount: DetectorFn = ({ nodes, rule }) => {
  const out: Recommendation[] = []
  const max = Number(rule.detector?.params?.max ?? 7)
  const byId = byIdMap(nodes)
  const parentToButtons = new Map<string, string[]>()
  for (const n of nodes) {
    if (!isTappable(n) || !n.parentId) continue
    const arr = parentToButtons.get(n.parentId) ?? []
    arr.push(n.id)
    parentToButtons.set(n.parentId, arr)
  }
  for (const [parentId, btnIds] of parentToButtons) {
    if (btnIds.length <= max) continue
    const parent = byId.get(parentId)
    if (!parent) continue
    out.push(
      buildRecommendation({
        rule,
        detectorId: 'choice-count',
        origin: 'auto',
        target: { nodeId: parent.id, nodeName: parent.name, path: resolveNodePath(parent.id, byId) },
        title: 'Слишком много действий в группе',
        summary: `В «${parent.name}» ${btnIds.length} кнопок — выбор занимает секунды.`,
        standard: 'Закон Хика',
        fix: {
          steps: [
            `Оставьте ${max}±2 основных действий.`,
            'Сгруппируйте вторичные в меню «Ещё» или overflow.',
            'Разбейте задачу на последовательные шаги.',
          ],
          expected: `≤ ${max}±2`,
          actual: `${btnIds.length}`,
        },
        measurements: { count: btnIds.length, max },
      }),
    )
  }
  return out
}
