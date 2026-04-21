/** Общие переменные стилей, чтобы не повторять inline-стили в каждом экране. */
export const colors = {
  bg: 'var(--figma-color-bg, #fff)',
  bgSecondary: 'var(--figma-color-bg-secondary, #f5f5f5)',
  text: 'var(--figma-color-text, #000)',
  textSecondary: 'var(--figma-color-text-secondary, #666)',
  border: 'var(--figma-color-border, #e5e5e5)',
  brand: 'var(--figma-color-bg-brand, #0d99ff)',
  brandText: 'var(--figma-color-text-onbrand, #fff)',
  danger: 'var(--figma-color-bg-danger, #f24822)',
  warning: 'var(--figma-color-bg-warning, #ffa629)',
  info: 'var(--figma-color-bg-component, #7b61ff)',
}

export const severityColor = {
  error: colors.danger,
  warning: colors.warning,
  info: colors.info,
} as const
