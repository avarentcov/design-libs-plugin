/**
 * Runtime-override каталога правил: переводит правила из `manual` в `ai`
 * без изменения upstream-каталога. Используется для того, чтобы AI-аудит
 * мог охватить максимум визуально-проверяемых правил (см. план расширения).
 */
import type { FigmaRule } from './rules-types'

/** ruleId, которые нужно поднять до AI-проверки (77 уникальных). */
export const PROMOTE_TO_AI = new Set<string>([
  // Типографика
  'orphan-widow', 'font-weight-contrast', 'text-color-levels',
  'number-tabular', 'text-alignment', 'truncation-strategy',
  // Цвет и контраст
  'semantic-color', 'semantic-colors', 'color-hierarchy',
  'dark-surface-levels', 'gradient-rules', 'opacity-vs-color',
  // Пространство
  '8pt-grid', 'consistent-spacing', 'consistent-spacing-scale',
  'padding-density', 'section-rhythm', 'responsive-spacing',
  // Компоненты
  'icon-label', 'skeleton-loading', 'modal-patterns',
  'table-best-practices', 'toast-notifications', 'breadcrumbs-navigation',
  'search-patterns', 'dropdown-menu-rules', 'tab-navigation',
  'avatar-component',
  // Тёмная тема
  'dark-image-dimming', 'dark-semantic-color',
  'dark-desaturation', 'dark-images',
  // Формы
  'inline-validation', 'input-width', 'error-message',
  'form-progress', 'input-sizing', 'placeholder-misuse',
  'auto-format', 'smart-defaults', 'password-ux',
  'select-vs-radio', 'form-layout-single-column', 'optional-vs-required',
  'date-picker-patterns', 'submit-button-position', 'destructive-confirmation',
  'autocomplete-attributes', 'keyboard-navigation-forms', 'character-counter',
  'toggle-vs-checkbox', 'form-success-state', 'form-field-grouping',
  // Иерархия (не-auto)
  'progressive-disclosure', 'icon-text-balance', 'content-priority',
  // Состояния (визуальные)
  'error-display', 'success-confirmation', 'selection-state',
  // Когнитивная нагрузка (визуальные)
  'cognitive-load', 'occams-razor', 'millers-law', 'chunking',
  // Гештальт
  'similarity', 'pragnanz', 'common-region',
  // Внимание
  'banner-blindness', 'visual-anchors',
  // Восприятие (визуальные)
  'juxtaposition', 'skeuomorphism', 'sensory-appeal', 'dark-mode-effect',
  // Эмоции (визуальные)
  'noble-edge-effect', 'affect-heuristic',
  // Память
  'picture-superiority',
  // Взаимодействие (визуальные)
  'signifiers', 'discoverability', 'autocomplete-effect',
])

/** Применяет override: manual-правила из списка становятся ai. */
export function applyAiOverrides(rules: FigmaRule[]): FigmaRule[] {
  return rules.map((r) =>
    PROMOTE_TO_AI.has(r.id) && r.checkType === 'manual'
      ? { ...r, checkType: 'ai' as const }
      : r,
  )
}
