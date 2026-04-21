import type { FigmaRule } from '../../shared/rules-types'
import type { SerializedNode, RGBA } from '../../shared/serialize'

let idSeq = 0

export function mkNode(partial: Partial<SerializedNode>): SerializedNode {
  const id = partial.id ?? `n${++idSeq}`
  return {
    id,
    name: partial.name ?? id,
    type: partial.type ?? 'FRAME',
    visible: partial.visible ?? true,
    opacity: partial.opacity ?? 1,
    locked: false,
    x: partial.x ?? 0,
    y: partial.y ?? 0,
    width: partial.width ?? 100,
    height: partial.height ?? 100,
    absoluteX: partial.absoluteX ?? partial.x ?? 0,
    absoluteY: partial.absoluteY ?? partial.y ?? 0,
    parentId: partial.parentId ?? null,
    childrenIds: partial.childrenIds ?? [],
    fills: partial.fills ?? [],
    strokes: partial.strokes ?? [],
    strokeWeight: partial.strokeWeight ?? 0,
    effects: partial.effects ?? [],
    cornerRadius: partial.cornerRadius ?? null,
    layoutMode: partial.layoutMode ?? 'NONE',
    itemSpacing: partial.itemSpacing ?? 0,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    componentId: null,
    text: partial.text ?? null,
  }
}

export function solid(r: number, g: number, b: number, a = 1) {
  return {
    type: 'SOLID',
    visible: true,
    opacity: 1,
    color: { r, g, b, a } as RGBA,
  }
}

export function rule(id: string, detectorId: string, params: Record<string, number | string | boolean> = {}, severity: 'error' | 'warning' | 'info' = 'warning'): FigmaRule {
  return {
    id,
    source: 'ui-guide',
    nameRu: id,
    nameEn: id,
    category: 'Иерархия',
    categoryEn: 'Hierarchy',
    summary: '',
    description: '',
    application: [],
    impact: 3,
    severity,
    checkType: 'auto',
    detector: { id: detectorId as FigmaRule['detector'] extends infer T ? T extends { id: infer I } ? I : never : never, params },
    tags: [],
    docUrl: '',
  }
}
