/**
 * Сериализация SceneNode → plain JSON для передачи в UI и прогона детекторов.
 * Никаких ссылок на figma.*, только обычные поля.
 */

export interface RGB { r: number; g: number; b: number }
export interface RGBA extends RGB { a: number }

export interface SerializedFill {
  type: string
  visible: boolean
  opacity: number
  color?: RGBA
  blendMode?: string
}

export interface SerializedStroke {
  type: string
  weight: number
  color?: RGBA
  visible: boolean
}

export interface SerializedEffect {
  type: string
  visible: boolean
  radius?: number
  offset?: { x: number; y: number }
  color?: RGBA
  spread?: number
}

export interface SerializedTextStyle {
  fontFamily: string
  fontStyle: string
  fontSize: number
  lineHeight: number | null // пиксели (null если 'AUTO')
  letterSpacing: number // пиксели
  letterSpacingPercent: number
  textAlignHorizontal: string
  textCase: string
  characters: string
}

export interface SerializedNode {
  id: string
  name: string
  type: string
  visible: boolean
  opacity: number
  locked: boolean
  x: number
  y: number
  width: number
  height: number
  absoluteX: number
  absoluteY: number
  parentId: string | null
  childrenIds: string[]
  fills: SerializedFill[]
  strokes: SerializedStroke[]
  strokeWeight: number
  effects: SerializedEffect[]
  cornerRadius: number | 'mixed' | null
  layoutMode: 'NONE' | 'HORIZONTAL' | 'VERTICAL'
  itemSpacing: number
  paddingTop: number
  paddingRight: number
  paddingBottom: number
  paddingLeft: number
  componentId: string | null
  text: SerializedTextStyle | null
}

const MAX_DEPTH = 12
const MAX_NODES = 2000

function toRgba(paint: Paint): RGBA | undefined {
  if (paint.type === 'SOLID') {
    const p = paint as SolidPaint
    return { r: p.color.r, g: p.color.g, b: p.color.b, a: p.opacity ?? 1 }
  }
  return undefined
}

function readFills(node: SceneNode): SerializedFill[] {
  const raw = (node as unknown as { fills?: readonly Paint[] | symbol }).fills
  if (!raw || typeof raw === 'symbol' || !Array.isArray(raw)) return []
  return raw.map((p) => ({
    type: p.type,
    visible: p.visible !== false,
    opacity: ('opacity' in p && typeof p.opacity === 'number') ? p.opacity : 1,
    color: toRgba(p),
    blendMode: 'blendMode' in p ? (p.blendMode as string) : undefined,
  }))
}

function readStrokes(node: SceneNode): SerializedStroke[] {
  const raw = (node as unknown as { strokes?: readonly Paint[] | symbol }).strokes
  if (!raw || typeof raw === 'symbol' || !Array.isArray(raw)) return []
  const weight = (node as unknown as { strokeWeight?: number | symbol }).strokeWeight
  const w = typeof weight === 'number' ? weight : 0
  return raw.map((p) => ({
    type: p.type,
    visible: p.visible !== false,
    color: toRgba(p),
    weight: w,
  }))
}

function readEffects(node: SceneNode): SerializedEffect[] {
  const raw = (node as unknown as { effects?: readonly Effect[] | symbol }).effects
  if (!raw || typeof raw === 'symbol' || !Array.isArray(raw)) return []
  return raw.map((e) => {
    const anyE = e as Effect & { offset?: Vector; color?: RGBA; spread?: number; radius?: number }
    return {
      type: e.type,
      visible: e.visible !== false,
      radius: anyE.radius,
      offset: anyE.offset ? { x: anyE.offset.x, y: anyE.offset.y } : undefined,
      color: anyE.color,
      spread: anyE.spread,
    }
  })
}

function readCornerRadius(node: SceneNode): number | 'mixed' | null {
  const v = (node as unknown as { cornerRadius?: number | symbol }).cornerRadius
  if (typeof v === 'number') return v
  if (typeof v === 'symbol') return 'mixed'
  return null
}

function readText(node: SceneNode): SerializedTextStyle | null {
  if (node.type !== 'TEXT') return null
  const t = node as TextNode
  const fontName = typeof t.fontName === 'symbol' ? { family: 'mixed', style: 'mixed' } : t.fontName
  const fontSize = typeof t.fontSize === 'symbol' ? 0 : (t.fontSize as number)
  let lhPx: number | null = null
  if (typeof t.lineHeight !== 'symbol') {
    const lh = t.lineHeight as LineHeight
    if (lh.unit === 'PIXELS') lhPx = lh.value
    else if (lh.unit === 'PERCENT') lhPx = (lh.value / 100) * fontSize
    else lhPx = null
  }
  let lsPx = 0
  let lsPct = 0
  if (typeof t.letterSpacing !== 'symbol') {
    const ls = t.letterSpacing as LetterSpacing
    if (ls.unit === 'PIXELS') { lsPx = ls.value; lsPct = fontSize ? (ls.value / fontSize) * 100 : 0 }
    else { lsPct = ls.value; lsPx = (ls.value / 100) * fontSize }
  }
  return {
    fontFamily: fontName.family,
    fontStyle: fontName.style,
    fontSize,
    lineHeight: lhPx,
    letterSpacing: lsPx,
    letterSpacingPercent: lsPct,
    textAlignHorizontal: typeof t.textAlignHorizontal === 'symbol' ? 'mixed' : t.textAlignHorizontal,
    textCase: typeof t.textCase === 'symbol' ? 'mixed' : (t.textCase as string),
    characters: t.characters,
  }
}

function hasAbsoluteBbox(n: SceneNode): n is SceneNode & { absoluteBoundingBox: Rect | null } {
  return 'absoluteBoundingBox' in n
}

function serializeOne(node: SceneNode, parentId: string | null): SerializedNode {
  const abb = hasAbsoluteBbox(node) ? node.absoluteBoundingBox : null
  const childrenIds = 'children' in node ? node.children.map((c) => c.id) : []
  const layoutMode = (node as unknown as { layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL' }).layoutMode ?? 'NONE'
  const get = <T,>(k: string, fallback: T): T => {
    const v = (node as unknown as Record<string, unknown>)[k]
    return (typeof v === 'number' ? v : fallback) as T
  }
  const componentId = (node as unknown as { componentId?: string }).componentId ?? null

  return {
    id: node.id,
    name: node.name,
    type: node.type,
    visible: node.visible,
    opacity: (node as unknown as { opacity?: number }).opacity ?? 1,
    locked: node.locked,
    x: 'x' in node ? (node.x as number) : 0,
    y: 'y' in node ? (node.y as number) : 0,
    width: 'width' in node ? (node.width as number) : 0,
    height: 'height' in node ? (node.height as number) : 0,
    absoluteX: abb?.x ?? 0,
    absoluteY: abb?.y ?? 0,
    parentId,
    childrenIds,
    fills: readFills(node),
    strokes: readStrokes(node),
    strokeWeight: typeof (node as unknown as { strokeWeight?: number | symbol }).strokeWeight === 'number'
      ? ((node as unknown as { strokeWeight: number }).strokeWeight)
      : 0,
    effects: readEffects(node),
    cornerRadius: readCornerRadius(node),
    layoutMode,
    itemSpacing: get<number>('itemSpacing', 0),
    paddingTop: get<number>('paddingTop', 0),
    paddingRight: get<number>('paddingRight', 0),
    paddingBottom: get<number>('paddingBottom', 0),
    paddingLeft: get<number>('paddingLeft', 0),
    componentId,
    text: readText(node),
  }
}

export function serializeTree(root: SceneNode, parentId: string | null = null): SerializedNode[] {
  const out: SerializedNode[] = []
  const queue: Array<{ node: SceneNode; parent: string | null; depth: number }> = [
    { node: root, parent: parentId, depth: 0 },
  ]
  while (queue.length && out.length < MAX_NODES) {
    const { node, parent, depth } = queue.shift()!
    out.push(serializeOne(node, parent))
    if (depth < MAX_DEPTH && 'children' in node) {
      for (const child of node.children) {
        queue.push({ node: child, parent: node.id, depth: depth + 1 })
      }
    }
  }
  return out
}
