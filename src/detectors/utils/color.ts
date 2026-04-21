import type { RGBA, SerializedFill, SerializedNode } from '../../shared/serialize'

/** WCAG 2.2 §1.4.3 — sRGB относительная яркость. Входные r/g/b в диапазоне 0–1. */
export function luminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const t = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  return 0.2126 * t(r) + 0.7152 * t(g) + 0.0722 * t(b)
}

/** Коэффициент контраста WCAG. Возвращает число ≥ 1 (чем выше — тем лучше). */
export function contrastRatio(fg: RGBA, bg: RGBA): number {
  const l1 = luminance(fg)
  const l2 = luminance(bg)
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (hi + 0.05) / (lo + 0.05)
}

/** Смешать RGBA поверх сплошного фона (учесть alpha). */
export function flatten(color: RGBA, bg: RGBA): RGBA {
  const a = color.a
  return {
    r: color.r * a + bg.r * (1 - a),
    g: color.g * a + bg.g * (1 - a),
    b: color.b * a + bg.b * (1 - a),
    a: 1,
  }
}

/** Первый видимый solid-fill. */
export function firstVisibleSolid(fills: SerializedFill[]): RGBA | null {
  for (const f of fills) {
    if (!f.visible) continue
    if (f.type !== 'SOLID') continue
    if (!f.color) continue
    return { ...f.color, a: f.color.a * (f.opacity ?? 1) }
  }
  return null
}

/** Найти эффективный bg для текстовой ноды: идём по родителям, берём первый видимый solid-fill. */
export function resolveBackground(
  node: SerializedNode,
  byId: Map<string, SerializedNode>,
  fallback: RGBA = { r: 1, g: 1, b: 1, a: 1 },
): RGBA {
  let cur: SerializedNode | undefined = node.parentId ? byId.get(node.parentId) : undefined
  while (cur) {
    const solid = firstVisibleSolid(cur.fills)
    if (solid && solid.a >= 0.5) return { ...solid, a: 1 }
    cur = cur.parentId ? byId.get(cur.parentId) : undefined
  }
  return fallback
}

export function isLargeText(fontSize: number, fontStyle: string): boolean {
  const bold = /bold|black|heavy|extrabold/i.test(fontStyle)
  return fontSize >= 18 || (bold && fontSize >= 14)
}

export function colorKey(c: RGBA): string {
  const to255 = (v: number) => Math.round(v * 255)
  return `${to255(c.r)},${to255(c.g)},${to255(c.b)},${Math.round(c.a * 100)}`
}
