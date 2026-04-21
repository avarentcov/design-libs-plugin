import type { DetectorFn, Recommendation } from './types'
import { buildRecommendation } from '../shared/recommendation'
import { byIdMap, resolveNodePath } from './utils/geometry'
import { contrastRatio, firstVisibleSolid, flatten, isLargeText, resolveBackground } from './utils/color'

/** contrast-wcag: контраст текста по WCAG 2.2 §1.4.3. */
export const contrastWcag: DetectorFn = ({ nodes, rule, settings }) => {
  const out: Recommendation[] = []
  const byId = byIdMap(nodes)
  const params = rule.detector?.params ?? {}
  const normalMin = Number(params.normal ?? 4.5)
  const largeMin = Number(params.large ?? 3)
  for (const n of nodes) {
    if (n.type !== 'TEXT' || !n.text || !n.visible) continue
    const fg = firstVisibleSolid(n.fills)
    if (!fg) continue
    const bgBase = resolveBackground(n, byId, settings.darkTheme ? { r: 0.07, g: 0.07, b: 0.08, a: 1 } : { r: 1, g: 1, b: 1, a: 1 })
    const fgFlat = flatten(fg, bgBase)
    const ratio = contrastRatio(fgFlat, bgBase)
    const large = isLargeText(n.text.fontSize, n.text.fontStyle)
    const min = large ? largeMin : normalMin
    if (ratio + 1e-6 < min) {
      out.push(
        buildRecommendation({
          rule,
          detectorId: 'contrast-wcag',
          origin: 'auto',
          target: { nodeId: n.id, nodeName: n.name, path: resolveNodePath(n.id, byId) },
          title: large ? 'Низкий контраст крупного текста' : 'Низкий контраст текста',
          summary: `Контраст ${ratio.toFixed(2)}:1 ниже минимума ${min}:1${large ? ' (крупный текст)' : ''}.`,
          standard: 'WCAG 2.2 §1.4.3',
          fix: {
            steps: [
              'Затемните цвет текста или осветлите фон.',
              'Проверьте, что контраст ≥ нужного минимума во всех состояниях (hover/active).',
            ],
            expected: `контраст ≥ ${min}:1`,
            actual: `${ratio.toFixed(2)}:1`,
          },
          measurements: { ratio: Number(ratio.toFixed(2)), required: min, large },
        }),
      )
    }
  }
  return out
}

/** contrast-nontext: контраст нетекстовых UI-элементов ≥ 3:1. */
export const contrastNontext: DetectorFn = ({ nodes, rule }) => {
  const out: Recommendation[] = []
  const byId = byIdMap(nodes)
  const min = Number(rule.detector?.params?.minRatio ?? 3)
  for (const n of nodes) {
    if (n.type === 'TEXT') continue
    if (!n.visible) continue
    const isInteractive = /btn|button|chip|tab|input|field|icon|toggle|switch|checkbox|radio/i.test(n.name)
    if (!isInteractive) continue
    const fg = firstVisibleSolid(n.fills) ?? (n.strokes[0]?.color ? { ...n.strokes[0].color } : null)
    if (!fg) continue
    const bg = resolveBackground(n, byId, { r: 1, g: 1, b: 1, a: 1 })
    const fgFlat = flatten({ ...fg, a: fg.a ?? 1 }, bg)
    const ratio = contrastRatio(fgFlat, bg)
    if (ratio + 1e-6 < min) {
      out.push(
        buildRecommendation({
          rule,
          detectorId: 'contrast-nontext',
          origin: 'auto',
          target: { nodeId: n.id, nodeName: n.name, path: resolveNodePath(n.id, byId) },
          title: 'Низкий контраст UI-элемента',
          summary: `Интерактивный элемент имеет контраст ${ratio.toFixed(2)}:1.`,
          standard: 'WCAG 2.2 §1.4.11',
          fix: {
            steps: ['Усильте цвет обводки или заливки элемента.', 'Для иконок проверьте контраст с реальным фоном.'],
            expected: `контраст ≥ ${min}:1`,
            actual: `${ratio.toFixed(2)}:1`,
          },
          measurements: { ratio: Number(ratio.toFixed(2)) },
        }),
      )
    }
  }
  return out
}

/** text-on-image: текст поверх изображения — ручная проверка. */
export const textOnImage: DetectorFn = ({ nodes, rule }) => {
  const out: Recommendation[] = []
  const byId = byIdMap(nodes)
  for (const n of nodes) {
    if (n.type !== 'TEXT' || !n.visible) continue
    let cur = n.parentId ? byId.get(n.parentId) : undefined
    while (cur) {
      const hasImage = cur.fills.some((f) => f.visible && f.type === 'IMAGE')
      if (hasImage) {
        out.push(
          buildRecommendation({
            rule,
            detectorId: 'text-on-image',
            origin: 'auto',
            target: { nodeId: n.id, nodeName: n.name, path: resolveNodePath(n.id, byId) },
            title: 'Текст поверх изображения',
            summary: 'Читаемость текста зависит от содержимого фото — нужна ручная проверка.',
            fix: {
              steps: [
                'Добавьте затемняющий градиент или полупрозрачную подложку.',
                'Или перенесите текст в область без сюжета.',
                'Проверьте контраст на самом светлом участке изображения.',
              ],
            },
          }),
        )
        break
      }
      cur = cur.parentId ? byId.get(cur.parentId) : undefined
    }
  }
  return out
}
