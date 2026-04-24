/**
 * Пороги детекторов — пользовательские переопределения базовых значений
 * каталога. Храним плоским объектом, мапим в `rule.detector.params` при
 * прогоне детекторов.
 */
import type { FigmaRule } from './rules-types'

export interface Thresholds {
  // Контраст WCAG (contrast-wcag)
  contrastNormal: number   // обычный текст, минимум 4.5 (AA)
  contrastLarge: number    // крупный текст, минимум 3 (AA)

  // Контраст не-текстовых элементов (contrast-nontext)
  contrastNontext: number  // иконки, границы полей, минимум 3

  // Тач-зоны (touch-target)
  touchIos: number         // iOS HIG 44
  touchAndroid: number     // Material 48
  touchWeb: number         // Web 44

  // Минимальный размер кнопки (button-min-size)
  buttonMinSize: number    // 48

  // Скругления (radius-consistency)
  maxRadiusVariants: number  // 2

  // Обводки (stroke-consistency)
  maxStrokeVariants: number  // 2

  // Тени (shadow-consistency)
  maxShadowLevels: number  // 4

  // Палитра (palette-size)
  maxPaletteColors: number  // 6

  // Шрифты
  fontSizeMin: number        // 12 (font-size-min.softMin)
  maxFontSizes: number       // 4 (font-sizes-scale.maxDistinct)
  maxFontFamilies: number    // 2 (font-families)

  // Интерлиньяж (line-height)
  lineHeightMin: number    // 1.35 (softMin)
  lineHeightMax: number    // 1.75 (softMax)

  // Длина строки (line-length)
  lineLengthMax: number    // 80 (info при превышении)

  // Закон Хика (choice-count)
  maxChoices: number       // 7
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  contrastNormal: 4.5,
  contrastLarge: 3,
  contrastNontext: 3,
  touchIos: 44,
  touchAndroid: 48,
  touchWeb: 44,
  buttonMinSize: 48,
  maxRadiusVariants: 2,
  maxStrokeVariants: 2,
  maxShadowLevels: 4,
  maxPaletteColors: 6,
  fontSizeMin: 12,
  maxFontSizes: 4,
  maxFontFamilies: 2,
  lineHeightMin: 1.35,
  lineHeightMax: 1.75,
  lineLengthMax: 80,
  maxChoices: 7,
}

/**
 * Применяет пороги к правилам: клонирует rule.detector.params с подставленными
 * пользовательскими значениями. Возвращает новый массив, исходный не мутирует.
 */
export function applyThresholds(rules: FigmaRule[], t: Thresholds): FigmaRule[] {
  return rules.map((rule) => {
    if (!rule.detector) return rule
    const detId = rule.detector.id
    const base = rule.detector.params ?? {}
    let overrides: Record<string, number> | null = null
    switch (detId) {
      case 'contrast-wcag':
        overrides = { normal: t.contrastNormal, large: t.contrastLarge }
        break
      case 'contrast-nontext':
        overrides = { minRatio: t.contrastNontext }
        break
      case 'touch-target':
        overrides = { ios: t.touchIos, android: t.touchAndroid, web: t.touchWeb }
        break
      case 'button-min-size':
        overrides = { minWidth: t.buttonMinSize, minHeight: t.buttonMinSize }
        break
      case 'radius-consistency':
        overrides = { maxVariants: t.maxRadiusVariants }
        break
      case 'stroke-consistency':
        overrides = { maxWeights: t.maxStrokeVariants }
        break
      case 'shadow-consistency':
        overrides = { maxLevels: t.maxShadowLevels }
        break
      case 'palette-size':
        overrides = { max: t.maxPaletteColors }
        break
      case 'font-size-min':
        overrides = { softMin: t.fontSizeMin }
        break
      case 'font-sizes-scale':
        overrides = { maxDistinct: t.maxFontSizes }
        break
      case 'font-families':
        overrides = { maxFamilies: t.maxFontFamilies }
        break
      case 'line-height':
        overrides = { softMin: t.lineHeightMin, softMax: t.lineHeightMax }
        break
      case 'line-length':
        overrides = { max: t.lineLengthMax }
        break
      case 'choice-count':
        overrides = { max: t.maxChoices }
        break
    }
    if (!overrides) return rule
    return {
      ...rule,
      detector: { ...rule.detector, params: { ...base, ...overrides } },
    }
  })
}
