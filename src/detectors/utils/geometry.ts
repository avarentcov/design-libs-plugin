import type { SerializedNode } from '../../shared/serialize'

export function byIdMap(nodes: SerializedNode[]): Map<string, SerializedNode> {
  const m = new Map<string, SerializedNode>()
  for (const n of nodes) m.set(n.id, n)
  return m
}

/** «Page › Frame › Card › Text» — путь к ноде через имена родителей. */
export function resolveNodePath(nodeId: string, byId: Map<string, SerializedNode>): string {
  const parts: string[] = []
  let cur = byId.get(nodeId)
  let depth = 0
  while (cur && depth < 8) {
    parts.unshift(cur.name || cur.type)
    if (!cur.parentId) break
    cur = byId.get(cur.parentId)
    depth++
  }
  return parts.join(' › ')
}

export function isTappable(node: SerializedNode): boolean {
  if (!node.visible || node.opacity < 0.1) return false
  if (/^(btn|button|cta|tap|link|icon-button)/i.test(node.name)) return true
  if (node.type === 'INSTANCE' && /button|btn|tab|chip|icon/i.test(node.name)) return true
  return false
}

/** Прямоугольники пересекаются (абсолютные координаты). */
export function rectsOverlap(
  a: SerializedNode,
  b: SerializedNode,
  inflate = 0,
): boolean {
  const ax1 = a.absoluteX - inflate
  const ay1 = a.absoluteY - inflate
  const ax2 = a.absoluteX + a.width + inflate
  const ay2 = a.absoluteY + a.height + inflate
  const bx1 = b.absoluteX
  const by1 = b.absoluteY
  const bx2 = b.absoluteX + b.width
  const by2 = b.absoluteY + b.height
  return ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1
}

export function distanceBetween(a: SerializedNode, b: SerializedNode): number {
  const ax2 = a.absoluteX + a.width
  const ay2 = a.absoluteY + a.height
  const bx2 = b.absoluteX + b.width
  const by2 = b.absoluteY + b.height
  const dx = Math.max(0, Math.max(a.absoluteX - bx2, b.absoluteX - ax2))
  const dy = Math.max(0, Math.max(a.absoluteY - by2, b.absoluteY - ay2))
  return Math.hypot(dx, dy)
}
