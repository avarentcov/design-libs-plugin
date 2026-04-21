import type { DetectorFn, Recommendation } from './types'
import { buildRecommendation } from '../shared/recommendation'
import type { Severity } from '../shared/rules-types'
import { byIdMap, resolveNodePath } from './utils/geometry'
import { colorKey, firstVisibleSolid } from './utils/color'

/** palette-size: градиент. max = идеал, hardMax = когда error. */
export const paletteSize: DetectorFn = ({ nodes, rule }) => {
  const max = Number(rule.detector?.params?.max ?? 6)
  const hardMax = Number(rule.detector?.params?.hardMax ?? 10)
  const colors = new Set<string>()
  for (const n of nodes) {
    const solid = firstVisibleSolid(n.fills)
    if (solid) colors.add(colorKey(solid))
  }
  if (colors.size <= max) return []
  const root = nodes[0]
  if (!root) return []
  const severity: Severity = colors.size > hardMax ? 'error' : 'warning'
  return [
    buildRecommendation({
      rule,
      detectorId: 'palette-size',
      origin: 'auto',
      severity,
      target: { nodeId: root.id, nodeName: root.name },
      title: severity === 'error' ? 'Раздутая палитра' : 'Палитра шире рекомендуемой',
      summary: `В макете ${colors.size} уникальных цветов заливки.`,
      fix: {
        steps: [
          `Сократите до ${max} цветов.`,
          'Оттенки от базы + семантика (success/warning/error).',
          'Закрепите палитру в токенах.',
        ],
        expected: `≤ ${max}`,
        actual: String(colors.size),
      },
      measurements: { count: colors.size, max, hardMax },
    }),
  ]
}

/** dark-theme-purity. */
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
          ? 'Чистый чёрный делает UI «глухим» и даёт слишком резкий контраст.'
          : 'Чистый белый текст на тёмном фоне мерцает и утомляет глаз.',
        fix: {
          steps: isPureBlack
            ? ['Фон: #0B0B0F или #121214.', 'Карточки: #1A1B1F.']
            : ['Основной текст: #E6E6EA или #DDDDE4.', 'Приглушённый: #A0A2AB.'],
          expected: isPureBlack ? '#0B0B0F / #121214' : '#E6E6EA',
          actual: isPureBlack ? '#000000' : '#FFFFFF',
        },
      }),
    )
  }
  return out
}
