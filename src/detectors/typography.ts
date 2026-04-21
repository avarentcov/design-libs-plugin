import type { DetectorFn, Recommendation } from './types'
import { buildRecommendation } from '../shared/recommendation'
import { byIdMap, resolveNodePath } from './utils/geometry'

/** font-size-min: основной текст не мельче 12 px. */
export const fontSizeMin: DetectorFn = ({ nodes, rule }) => {
  const out: Recommendation[] = []
  const byId = byIdMap(nodes)
  const min = Number(rule.detector?.params?.min ?? 12)
  for (const n of nodes) {
    if (n.type !== 'TEXT' || !n.text || !n.visible) continue
    if (n.text.fontSize > 0 && n.text.fontSize < min) {
      out.push(
        buildRecommendation({
          rule,
          detectorId: 'font-size-min',
          origin: 'auto',
          target: { nodeId: n.id, nodeName: n.name, path: resolveNodePath(n.id, byId) },
          title: 'Слишком мелкий шрифт',
          summary: `Размер ${n.text.fontSize} px меньше минимума ${min} px.`,
          fix: {
            steps: [`Увеличьте до ${min} px или крупнее.`, 'Для служебного текста используйте размер ≥ 11 px с хорошим контрастом.'],
            expected: `≥ ${min} px`,
            actual: `${n.text.fontSize} px`,
          },
          measurements: { fontSize: n.text.fontSize, min },
        }),
      )
    }
  }
  return out
}

/** line-height: body-текст 1.4–1.6. */
export const lineHeight: DetectorFn = ({ nodes, rule }) => {
  const out: Recommendation[] = []
  const byId = byIdMap(nodes)
  const bodyMin = Number(rule.detector?.params?.bodyMin ?? 1.4)
  const bodyMax = Number(rule.detector?.params?.bodyMax ?? 1.6)
  for (const n of nodes) {
    if (n.type !== 'TEXT' || !n.text || !n.visible) continue
    if (n.text.fontSize < 12 || n.text.fontSize > 20) continue // только body
    if (n.text.lineHeight == null || n.text.fontSize === 0) continue
    const ratio = n.text.lineHeight / n.text.fontSize
    if (ratio < bodyMin || ratio > bodyMax) {
      out.push(
        buildRecommendation({
          rule,
          detectorId: 'line-height',
          origin: 'auto',
          target: { nodeId: n.id, nodeName: n.name, path: resolveNodePath(n.id, byId) },
          title: 'Неподходящий междустрочный интервал',
          summary: `Line-height ${ratio.toFixed(2)} выходит из диапазона ${bodyMin}–${bodyMax} для body.`,
          fix: {
            steps: [
              `Приведите line-height к ${bodyMin}–${bodyMax} × размер шрифта.`,
              `Для ${n.text.fontSize} px это ${Math.round(n.text.fontSize * 1.5)} px.`,
            ],
            expected: `${bodyMin}–${bodyMax}`,
            actual: ratio.toFixed(2),
          },
          measurements: { ratio: Number(ratio.toFixed(2)) },
        }),
      )
    }
  }
  return out
}

/** line-length: CPL для длинных параграфов. */
export const lineLength: DetectorFn = ({ nodes, rule }) => {
  const out: Recommendation[] = []
  const byId = byIdMap(nodes)
  const ideal = Number(rule.detector?.params?.idealMax ?? 75)
  const max = Number(rule.detector?.params?.max ?? 90)
  for (const n of nodes) {
    if (n.type !== 'TEXT' || !n.text || !n.visible) continue
    if (!n.text.characters || n.text.characters.length < 80) continue
    const charsPerPx = n.text.fontSize * 0.5 || 1
    const cpl = n.width / charsPerPx
    if (cpl > max) {
      out.push(
        buildRecommendation({
          rule,
          detectorId: 'line-length',
          origin: 'auto',
          target: { nodeId: n.id, nodeName: n.name, path: resolveNodePath(n.id, byId) },
          title: 'Слишком длинная строка',
          summary: `Оценочная длина ≈ ${Math.round(cpl)} символов — глаз теряет начало следующей строки.`,
          fix: {
            steps: [`Уменьшите ширину текстового блока до ~${ideal} символов в строке.`, 'Для лонгридов держите 60–75 CPL.'],
            expected: `${ideal} CPL`,
            actual: `${Math.round(cpl)} CPL`,
          },
          measurements: { cpl: Math.round(cpl), ideal, max },
        }),
      )
    }
  }
  return out
}

/** font-sizes-scale: ≤ 5 различных размеров. */
export const fontSizesScale: DetectorFn = ({ nodes, rule }) => {
  const maxDistinct = Number(rule.detector?.params?.maxDistinct ?? 5)
  const sizes = new Set<number>()
  for (const n of nodes) {
    if (n.type === 'TEXT' && n.text && n.text.fontSize > 0) sizes.add(Math.round(n.text.fontSize))
  }
  if (sizes.size <= maxDistinct) return []
  const root = nodes[0]
  if (!root) return []
  const sorted = [...sizes].sort((a, b) => a - b)
  return [
    buildRecommendation({
      rule,
      detectorId: 'font-sizes-scale',
      origin: 'auto',
      target: { nodeId: root.id, nodeName: root.name },
      title: 'Разнобой размеров шрифта',
      summary: `В макете ${sizes.size} разных размеров: ${sorted.join(', ')} px.`,
      fix: {
        steps: [
          `Сведите типографическую шкалу к ${maxDistinct} размерам.`,
          'Зафиксируйте шкалу в стилях и применяйте из неё.',
        ],
        expected: `≤ ${maxDistinct} размеров`,
        actual: `${sizes.size} размеров`,
      },
      measurements: { count: sizes.size, max: maxDistinct },
    }),
  ]
}

/** font-families: ≤ 2 семейства. */
export const fontFamilies: DetectorFn = ({ nodes, rule }) => {
  const max = Number(rule.detector?.params?.maxFamilies ?? 2)
  const families = new Set<string>()
  for (const n of nodes) {
    if (n.type === 'TEXT' && n.text?.fontFamily && n.text.fontFamily !== 'mixed') {
      families.add(n.text.fontFamily)
    }
  }
  if (families.size <= max) return []
  const root = nodes[0]
  if (!root) return []
  return [
    buildRecommendation({
      rule,
      detectorId: 'font-families',
      origin: 'auto',
      target: { nodeId: root.id, nodeName: root.name },
      title: 'Слишком много шрифтовых семейств',
      summary: `Используется ${families.size} семейств: ${[...families].join(', ')}.`,
      fix: {
        steps: [`Оставьте не более ${max} семейств (дисплейное + текстовое).`, 'Для акцентов используйте начертание, а не новое семейство.'],
        expected: `≤ ${max}`,
        actual: String(families.size),
      },
      measurements: { count: families.size, max },
    }),
  ]
}

/** letter-spacing: для body −1…+2.5%. */
export const letterSpacing: DetectorFn = ({ nodes, rule }) => {
  const out: Recommendation[] = []
  const byId = byIdMap(nodes)
  const minPct = Number(rule.detector?.params?.minPct ?? -1)
  const maxPct = Number(rule.detector?.params?.maxPct ?? 2.5)
  for (const n of nodes) {
    if (n.type !== 'TEXT' || !n.text || !n.visible) continue
    if (n.text.fontSize > 20) continue // не трогаем заголовки
    const pct = n.text.letterSpacingPercent
    if (pct < minPct || pct > maxPct) {
      out.push(
        buildRecommendation({
          rule,
          detectorId: 'letter-spacing',
          origin: 'auto',
          target: { nodeId: n.id, nodeName: n.name, path: resolveNodePath(n.id, byId) },
          title: 'Нестандартный letter-spacing',
          summary: `Трекинг ${pct.toFixed(1)}% выходит за рамки ${minPct}…${maxPct}% для body.`,
          fix: {
            steps: [`Уменьшите letter-spacing до ${minPct}…${maxPct}%.`, 'Капс и мелкий UI-текст могут иметь +2…+5%, но для параграфов не надо.'],
            expected: `${minPct}…${maxPct}%`,
            actual: `${pct.toFixed(1)}%`,
          },
          measurements: { pct: Number(pct.toFixed(1)) },
        }),
      )
    }
  }
  return out
}
