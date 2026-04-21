import type { DetectorFn, Recommendation } from './types'
import { buildRecommendation } from '../shared/recommendation'
import type { Severity } from '../shared/rules-types'
import { byIdMap, resolveNodePath } from './utils/geometry'
import { contrastRatio, firstVisibleSolid, flatten, isLargeText, resolveBackground } from './utils/color'

/**
 * contrast-wcag: контраст текста по WCAG 2.2.
 * Градиент:
 *   ratio < AA → error (серьёзное нарушение)
 *   AA ≤ ratio < AAA → warning (проходит AA, не проходит AAA)
 */
export const contrastWcag: DetectorFn = ({ nodes, rule, settings }) => {
  const out: Recommendation[] = []
  const byId = byIdMap(nodes)
  const params = rule.detector?.params ?? {}
  const aaNormal = Number(params.normal ?? 4.5)
  const aaLarge = Number(params.large ?? 3)
  const aaaNormal = Number(params.strictNormal ?? 7)
  const aaaLarge = Number(params.strictLarge ?? 4.5)
  for (const n of nodes) {
    if (n.type !== 'TEXT' || !n.text || !n.visible) continue
    const fg = firstVisibleSolid(n.fills)
    if (!fg) continue
    const bgBase = resolveBackground(n, byId, settings.darkTheme ? { r: 0.07, g: 0.07, b: 0.08, a: 1 } : { r: 1, g: 1, b: 1, a: 1 })
    const fgFlat = flatten(fg, bgBase)
    const ratio = contrastRatio(fgFlat, bgBase)
    const large = isLargeText(n.text.fontSize, n.text.fontStyle)
    const aaMin = large ? aaLarge : aaNormal
    const aaaMin = large ? aaaLarge : aaaNormal

    let severity: Severity | null = null
    let title = ''
    let summary = ''
    if (ratio + 1e-6 < aaMin) {
      severity = 'error'
      title = large ? 'Низкий контраст крупного текста' : 'Низкий контраст текста'
      summary = `Контраст ${ratio.toFixed(2)}:1 ниже AA-минимума ${aaMin}:1${large ? ' (крупный текст)' : ''}.`
    } else if (ratio + 1e-6 < aaaMin) {
      severity = 'warning'
      title = 'Контраст проходит AA, но не AAA'
      summary = `Контраст ${ratio.toFixed(2)}:1 — пройдёт AA (≥${aaMin}:1), но не AAA (≥${aaaMin}:1).`
    }
    if (!severity) continue

    out.push(
      buildRecommendation({
        rule,
        detectorId: 'contrast-wcag',
        origin: 'auto',
        severity,
        target: { nodeId: n.id, nodeName: n.name, path: resolveNodePath(n.id, byId) },
        title,
        summary,
        standard: severity === 'error' ? 'WCAG 2.2 §1.4.3 (AA)' : 'WCAG 2.2 §1.4.6 (AAA)',
        fix: {
          steps: [
            'Затемните цвет текста или осветлите фон.',
            'Проверьте все состояния (hover/active/disabled).',
          ],
          expected: severity === 'error' ? `≥ ${aaMin}:1` : `≥ ${aaaMin}:1 (AAA)`,
          actual: `${ratio.toFixed(2)}:1`,
        },
        measurements: { ratio: Number(ratio.toFixed(2)), aaMin, aaaMin, large },
      }),
    )
  }
  return out
}

/** contrast-nontext: контраст нетекстовых UI-элементов. */
export const contrastNontext: DetectorFn = ({ nodes, rule }) => {
  const out: Recommendation[] = []
  const byId = byIdMap(nodes)
  const min = Number(rule.detector?.params?.minRatio ?? 3)
  const strict = Number(rule.detector?.params?.strictRatio ?? 4.5)
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

    let severity: Severity | null = null
    if (ratio + 1e-6 < min) severity = 'error'
    else if (ratio + 1e-6 < strict) severity = 'warning'
    if (!severity) continue

    out.push(
      buildRecommendation({
        rule,
        detectorId: 'contrast-nontext',
        origin: 'auto',
        severity,
        target: { nodeId: n.id, nodeName: n.name, path: resolveNodePath(n.id, byId) },
        title: severity === 'error' ? 'Низкий контраст UI-элемента' : 'UI-контраст у границы минимума',
        summary: `Интерактивный элемент имеет контраст ${ratio.toFixed(2)}:1.`,
        standard: 'WCAG 2.2 §1.4.11',
        fix: {
          steps: ['Усильте цвет обводки или заливки.', 'Для иконок проверьте контраст с реальным фоном.'],
          expected: severity === 'error' ? `≥ ${min}:1` : `≥ ${strict}:1 (рекомендуется)`,
          actual: `${ratio.toFixed(2)}:1`,
        },
        measurements: { ratio: Number(ratio.toFixed(2)) },
      }),
    )
  }
  return out
}

/** text-on-image: текст поверх изображения. */
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
