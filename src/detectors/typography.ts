import type { DetectorFn, Recommendation } from './types'
import { buildRecommendation } from '../shared/recommendation'
import type { Severity } from '../shared/rules-types'
import { byIdMap, resolveNodePath } from './utils/geometry'

/**
 * font-size-min: градиент
 *   < softMin (обычно 10) → error
 *   softMin ≤ size < min (12 < size < 14) → warning
 */
export const fontSizeMin: DetectorFn = ({ nodes, rule }) => {
  const out: Recommendation[] = []
  const byId = byIdMap(nodes)
  const min = Number(rule.detector?.params?.min ?? 14)
  const softMin = Number(rule.detector?.params?.softMin ?? 12)
  for (const n of nodes) {
    if (n.type !== 'TEXT' || !n.text || !n.visible) continue
    const sz = n.text.fontSize
    if (sz <= 0) continue
    let severity: Severity | null = null
    if (sz < softMin) severity = 'error'
    else if (sz < min) severity = 'warning'
    if (!severity) continue
    out.push(
      buildRecommendation({
        rule,
        detectorId: 'font-size-min',
        origin: 'auto',
        severity,
        target: { nodeId: n.id, nodeName: n.name, path: resolveNodePath(n.id, byId) },
        title: severity === 'error' ? 'Слишком мелкий шрифт' : 'Шрифт меньше рекомендуемого',
        summary: `Размер ${sz} px ${severity === 'error' ? `меньше минимума ${softMin}` : `ниже рекомендуемого ${min}`} px.`,
        fix: {
          steps: [
            `Увеличьте до ${severity === 'error' ? softMin : min} px.`,
            'Для служебного текста — не ниже 11 px с высоким контрастом.',
          ],
          expected: `≥ ${severity === 'error' ? softMin : min} px`,
          actual: `${sz} px`,
        },
        measurements: { fontSize: sz, min, softMin },
      }),
    )
  }
  return out
}

/** line-height: градиент (softMin/softMax = жёсткие границы; bodyMin/bodyMax = ideal). */
export const lineHeight: DetectorFn = ({ nodes, rule }) => {
  const out: Recommendation[] = []
  const byId = byIdMap(nodes)
  const bodyMin = Number(rule.detector?.params?.bodyMin ?? 1.5)
  const bodyMax = Number(rule.detector?.params?.bodyMax ?? 1.6)
  const softMin = Number(rule.detector?.params?.softMin ?? 1.35)
  const softMax = Number(rule.detector?.params?.softMax ?? 1.75)
  for (const n of nodes) {
    if (n.type !== 'TEXT' || !n.text || !n.visible) continue
    if (n.text.fontSize < 12 || n.text.fontSize > 20) continue
    if (n.text.lineHeight == null || n.text.fontSize === 0) continue
    const ratio = n.text.lineHeight / n.text.fontSize

    let severity: Severity | null = null
    if (ratio < softMin || ratio > softMax) severity = 'warning'
    else if (ratio < bodyMin || ratio > bodyMax) severity = 'info'
    if (!severity) continue

    out.push(
      buildRecommendation({
        rule,
        detectorId: 'line-height',
        origin: 'auto',
        severity,
        target: { nodeId: n.id, nodeName: n.name, path: resolveNodePath(n.id, byId) },
        title: severity === 'warning' ? 'Неподходящий междустрочный' : 'Интервал не по шкале',
        summary: `Line-height ${ratio.toFixed(2)} ${severity === 'warning' ? `вне допустимого ${softMin}–${softMax}` : `вне идеала ${bodyMin}–${bodyMax}`}.`,
        fix: {
          steps: [
            `Приведите line-height к ${bodyMin}–${bodyMax} × fontSize.`,
            `Для ${n.text.fontSize} px это ${Math.round(n.text.fontSize * 1.55)} px.`,
          ],
          expected: `${bodyMin}–${bodyMax}`,
          actual: ratio.toFixed(2),
        },
        measurements: { ratio: Number(ratio.toFixed(2)) },
      }),
    )
  }
  return out
}

/** line-length: градиент по CPL. */
export const lineLength: DetectorFn = ({ nodes, rule }) => {
  const out: Recommendation[] = []
  const byId = byIdMap(nodes)
  const ideal = Number(rule.detector?.params?.idealMax ?? 70)
  const max = Number(rule.detector?.params?.max ?? 80)
  const hardMax = Number(rule.detector?.params?.hardMax ?? 100)
  for (const n of nodes) {
    if (n.type !== 'TEXT' || !n.text || !n.visible) continue
    if (!n.text.characters || n.text.characters.length < 80) continue
    const charsPerPx = n.text.fontSize * 0.5 || 1
    const cpl = n.width / charsPerPx

    let severity: Severity | null = null
    if (cpl > hardMax) severity = 'warning'
    else if (cpl > max) severity = 'info'
    if (!severity) continue
    out.push(
      buildRecommendation({
        rule,
        detectorId: 'line-length',
        origin: 'auto',
        severity,
        target: { nodeId: n.id, nodeName: n.name, path: resolveNodePath(n.id, byId) },
        title: severity === 'warning' ? 'Слишком длинная строка' : 'Строка длиннее идеала',
        summary: `Оценочная длина ≈ ${Math.round(cpl)} символов.`,
        fix: {
          steps: [
            `Уменьшите ширину блока до ~${ideal} CPL.`,
            'Для лонгридов держите 55–70 символов в строке.',
          ],
          expected: `${ideal} CPL`,
          actual: `${Math.round(cpl)} CPL`,
        },
        measurements: { cpl: Math.round(cpl), ideal, max, hardMax },
      }),
    )
  }
  return out
}

/** font-sizes-scale: градиент. */
export const fontSizesScale: DetectorFn = ({ nodes, rule }) => {
  const maxDistinct = Number(rule.detector?.params?.maxDistinct ?? 4)
  const hardMax = Number(rule.detector?.params?.hardMax ?? 6)
  const sizes = new Set<number>()
  for (const n of nodes) {
    if (n.type === 'TEXT' && n.text && n.text.fontSize > 0) sizes.add(Math.round(n.text.fontSize))
  }
  if (sizes.size <= maxDistinct) return []
  const root = nodes[0]
  if (!root) return []
  const severity: Severity = sizes.size > hardMax ? 'error' : 'warning'
  const sorted = [...sizes].sort((a, b) => a - b)
  return [
    buildRecommendation({
      rule,
      detectorId: 'font-sizes-scale',
      origin: 'auto',
      severity,
      target: { nodeId: root.id, nodeName: root.name },
      title: severity === 'error' ? 'Сильный разнобой размеров' : 'Разнобой размеров шрифта',
      summary: `В макете ${sizes.size} разных размеров: ${sorted.join(', ')} px.`,
      fix: {
        steps: [
          `Сведите типографическую шкалу к ${maxDistinct} размерам.`,
          'Зафиксируйте шкалу в стилях и применяйте из неё.',
        ],
        expected: `≤ ${maxDistinct}`,
        actual: `${sizes.size}`,
      },
      measurements: { count: sizes.size, max: maxDistinct, hardMax },
    }),
  ]
}

/** font-families. */
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
  const severity: Severity = families.size > max + 1 ? 'error' : 'warning'
  return [
    buildRecommendation({
      rule,
      detectorId: 'font-families',
      origin: 'auto',
      severity,
      target: { nodeId: root.id, nodeName: root.name },
      title: 'Слишком много шрифтовых семейств',
      summary: `Используется ${families.size} семейств: ${[...families].join(', ')}.`,
      fix: {
        steps: [`Оставьте не более ${max} семейств (дисплейное + текстовое).`, 'Для акцентов — начертание, а не новое семейство.'],
        expected: `≤ ${max}`,
        actual: String(families.size),
      },
      measurements: { count: families.size, max },
    }),
  ]
}

/** letter-spacing: градиент softMin/softMax (warning) и hardMin/hardMax (error). */
export const letterSpacing: DetectorFn = ({ nodes, rule }) => {
  const out: Recommendation[] = []
  const byId = byIdMap(nodes)
  const minPct = Number(rule.detector?.params?.minPct ?? -0.5)
  const maxPct = Number(rule.detector?.params?.maxPct ?? 2)
  const hardMin = Number(rule.detector?.params?.hardMin ?? -1)
  const hardMax = Number(rule.detector?.params?.hardMax ?? 3)
  for (const n of nodes) {
    if (n.type !== 'TEXT' || !n.text || !n.visible) continue
    if (n.text.fontSize > 20) continue
    const pct = n.text.letterSpacingPercent

    let severity: Severity | null = null
    if (pct < hardMin || pct > hardMax) severity = 'warning'
    else if (pct < minPct || pct > maxPct) severity = 'info'
    if (!severity) continue
    out.push(
      buildRecommendation({
        rule,
        detectorId: 'letter-spacing',
        origin: 'auto',
        severity,
        target: { nodeId: n.id, nodeName: n.name, path: resolveNodePath(n.id, byId) },
        title: 'Нестандартный letter-spacing',
        summary: `Трекинг ${pct.toFixed(1)}% ${severity === 'warning' ? `выходит за ${hardMin}…${hardMax}%` : `вне идеала ${minPct}…${maxPct}%`}.`,
        fix: {
          steps: [
            `Приведите letter-spacing к ${minPct}…${maxPct}% для body.`,
            'Для капса можно +2…+5%, для параграфов — не стоит.',
          ],
          expected: `${minPct}…${maxPct}%`,
          actual: `${pct.toFixed(1)}%`,
        },
        measurements: { pct: Number(pct.toFixed(1)) },
      }),
    )
  }
  return out
}
