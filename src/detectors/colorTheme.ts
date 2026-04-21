import type { DetectorFn, Recommendation } from './types'
import { buildRecommendation } from '../shared/recommendation'
import { byIdMap, resolveNodePath } from './utils/geometry'
import { colorKey, firstVisibleSolid } from './utils/color'

/** palette-size: ≤ N уникальных цветов. */
export const paletteSize: DetectorFn = ({ nodes, rule }) => {
  const max = Number(rule.detector?.params?.max ?? 10)
  const colors = new Set<string>()
  for (const n of nodes) {
    const solid = firstVisibleSolid(n.fills)
    if (solid) colors.add(colorKey(solid))
  }
  if (colors.size <= max) return []
  const root = nodes[0]
  if (!root) return []
  return [
    buildRecommendation({
      rule,
      detectorId: 'palette-size',
      origin: 'auto',
      target: { nodeId: root.id, nodeName: root.name },
      title: 'Раздутая палитра',
      summary: `В макете ${colors.size} уникальных цветов заливки.`,
      fix: {
        steps: [
          `Сократите палитру до ${max} цветов.`,
          'Используйте шкалу оттенков от одного базового цвета + семантические (success/warning/error).',
          'Закрепите палитру в стилях/variables.',
        ],
        expected: `≤ ${max}`,
        actual: String(colors.size),
      },
      measurements: { count: colors.size, max },
    }),
  ]
}

/** dark-theme-purity: не использовать #000/#FFF в тёмной теме. */
export const darkThemePurity: DetectorFn = ({ nodes, rule, settings }) => {
  const out: Recommendation[] = []
  if (!settings.darkTheme) return out
  const byId = byIdMap(nodes)
  for (const n of nodes) {
    const s = firstVisibleSolid(n.fills)
    if (!s) continue
    const r = Math.round(s.r * 255)
    const g = Math.round(s.g * 255)
    const b = Math.round(s.b * 255)
    const isPureBlack = r === 0 && g === 0 && b === 0
    const isPureWhite = r === 255 && g === 255 && b === 255
    if (!isPureBlack && !isPureWhite) continue
    out.push(
      buildRecommendation({
        rule,
        detectorId: 'dark-theme-purity',
        origin: 'auto',
        target: { nodeId: n.id, nodeName: n.name, path: resolveNodePath(n.id, byId) },
        title: isPureBlack ? 'Чистый #000 в тёмной теме' : 'Чистый #FFF в тёмной теме',
        summary: isPureBlack
          ? 'Чистый чёрный делает UI «глухим» и увеличивает контраст до резкого.'
          : 'Чистый белый текст на тёмном фоне мерцает и утомляет глаз.',
        fix: {
          steps: isPureBlack
            ? ['Замените на #0B0B0F или #121214 для фона.', 'Для карточек используйте более светлый тон (#1A1B1F).']
            : ['Снизьте яркость текста до #E6E6EA или #DDDDE4.', 'Для приглушённого текста — #A0A2AB.'],
          expected: isPureBlack ? '#0B0B0F / #121214' : '#E6E6EA',
          actual: isPureBlack ? '#000000' : '#FFFFFF',
        },
      }),
    )
  }
  return out
}
