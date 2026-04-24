import type { DetectorId } from '../shared/rules-types'
import { contrastNontext, contrastWcag, textOnImage } from './contrast'
import { buttonMinSize, targetSpacing, touchTarget } from './targets'
import { fontFamilies, fontSizeMin, fontSizesScale, letterSpacing, lineHeight, lineLength } from './typography'
import { radiusConsistency, shadowConsistency, strokeConsistency } from './layout'
import { darkThemePurity, paletteSize } from './colorTheme'
import { disabledVisible, focusVisible, missingLabel } from './forms'
import { choiceCount } from './cognitive'
import type { DetectorContext, DetectorFn, Recommendation } from './types'

/** Реестр активных детекторов (grid-snap убран по решению — слишком шумит). */
export const DETECTORS: Partial<Record<DetectorId, DetectorFn>> = {
  'contrast-wcag': contrastWcag,
  'contrast-nontext': contrastNontext,
  'text-on-image': textOnImage,
  'touch-target': touchTarget,
  'button-min-size': buttonMinSize,
  'target-spacing': targetSpacing,
  'font-size-min': fontSizeMin,
  'line-height': lineHeight,
  'line-length': lineLength,
  'font-sizes-scale': fontSizesScale,
  'font-families': fontFamilies,
  'letter-spacing': letterSpacing,
  'radius-consistency': radiusConsistency,
  'stroke-consistency': strokeConsistency,
  'shadow-consistency': shadowConsistency,
  'palette-size': paletteSize,
  'dark-theme-purity': darkThemePurity,
  'missing-label': missingLabel,
  'disabled-visible': disabledVisible,
  'focus-visible': focusVisible,
  'choice-count': choiceCount,
}

/** Прогнать все auto-правила по списку нод.
 *  В каталоге один детектор (напр. `contrast-wcag`) может быть привязан к
 *  нескольким правилам — это даёт дубли одной и той же проблемы с разными
 *  ruleId. Дедупим на уровне запуска: каждый детектор исполняется один раз,
 *  и его результаты атрибутируются первому найденному правилу. */
export function runAutoAudit(
  ctxBase: Omit<DetectorContext, 'rule'>,
  rules: Array<DetectorContext['rule']>,
): Recommendation[] {
  const ranDetectors = new Set<string>()
  const all: Recommendation[] = []
  for (const rule of rules) {
    if (rule.checkType !== 'auto' || !rule.detector) continue
    const detId = rule.detector.id
    if (ranDetectors.has(detId)) continue
    const fn = DETECTORS[detId]
    if (!fn) continue
    ranDetectors.add(detId)
    try {
      const recs = fn({ ...ctxBase, rule })
      all.push(...recs)
    } catch (err) {
      console.error(`[detector ${detId}] failed:`, err)
    }
  }
  return all
}
