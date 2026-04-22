/**
 * Дизайн-токены в стиле shadcn/ui (neutral palette) + темизация от Figma.
 * Figma-переменные имеют приоритет, фоллбэк — shadcn light theme.
 */
export const colors = {
  // Поверхности
  bg: 'var(--figma-color-bg, hsl(0 0% 100%))',              // background
  bgSecondary: 'var(--figma-color-bg-secondary, hsl(0 0% 96.1%))', // muted
  bgHover: 'var(--figma-color-bg-hover, hsl(0 0% 95%))',
  card: 'var(--figma-color-bg, hsl(0 0% 100%))',

  // Текст
  text: 'var(--figma-color-text, hsl(0 0% 9%))',             // foreground
  textSecondary: 'var(--figma-color-text-secondary, hsl(0 0% 45.1%))', // muted-foreground

  // Границы
  border: 'var(--figma-color-border, hsl(0 0% 89.8%))',      // border
  borderStrong: 'var(--figma-color-border-strong, hsl(0 0% 82%))',

  // Primary (в shadcn neutral — чёрный)
  brand: 'var(--figma-color-bg-brand, hsl(0 0% 9%))',
  brandText: 'var(--figma-color-text-onbrand, hsl(0 0% 98%))',
  brandHover: 'var(--figma-color-bg-brand-hover, hsl(0 0% 20%))',

  // Accent
  accent: 'var(--figma-color-bg-accent, hsl(0 0% 96.1%))',

  // Severity — пастельнее, ближе к shadcn badges
  danger: 'var(--figma-color-bg-danger, hsl(0 84.2% 60.2%))',
  warning: 'var(--figma-color-bg-warning, hsl(38 92% 50%))',
  info: 'var(--figma-color-bg-component, hsl(221 83% 53%))',
  success: 'var(--figma-color-bg-success, hsl(142 71% 45%))',
}

export const severityColor = {
  error: colors.danger,
  warning: colors.warning,
  info: colors.info,
} as const

/** shadcn-like radius scale */
export const radius = {
  sm: 4,
  md: 6,
  lg: 8,
  xl: 10,
}

/** Типографика — SF / Inter fallback */
export const fontFamily = `"Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif`
