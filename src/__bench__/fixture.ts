import type { FigmaRule } from '../shared/rules-types'
import type { SerializedNode } from '../shared/serialize'

/** Синтетическая фикстура ≈50 слоёв: фрейм с карточками, кнопками, полями и текстом. */
export function makeFixture(): SerializedNode[] {
  const nodes: SerializedNode[] = []
  let idSeq = 0
  const nextId = () => `n${++idSeq}`

  const root = mk({
    id: nextId(),
    name: 'page',
    type: 'FRAME',
    width: 1440,
    height: 900,
    fills: [solid(1, 1, 1)],
    childrenIds: [],
  })
  nodes.push(root)

  // 4 карточки
  for (let c = 0; c < 4; c++) {
    const card = mk({
      id: nextId(),
      name: `card-${c}`,
      type: 'FRAME',
      parentId: root.id,
      x: 40 + c * 340, // 40, 380, 720, 1060 — все кратны 4 и 8
      y: 120,
      width: 320,
      height: 240,
      fills: [solid(1, 1, 1)],
      cornerRadius: 8,
      strokes: [{ type: 'SOLID', visible: true, weight: 1, color: { r: 0.85, g: 0.85, b: 0.85, a: 1 } }],
      strokeWeight: 1,
      effects: [{ type: 'DROP_SHADOW', visible: true, radius: 8, offset: { x: 0, y: 2 }, color: { r: 0, g: 0, b: 0, a: 0.08 } }],
      childrenIds: [],
    })
    root.childrenIds.push(card.id)
    nodes.push(card)

    // Заголовок
    const title = mk({
      id: nextId(), name: `title-${c}`, type: 'TEXT', parentId: card.id,
      x: 16, y: 16, absoluteX: card.x + 16, absoluteY: card.y + 16,
      width: 280, height: 28,
      fills: [solid(0.1, 0.1, 0.1)],
      text: text('Inter', 'Bold', 18, 24, 'Заголовок карточки'),
    })
    card.childrenIds.push(title.id)
    nodes.push(title)

    // Описание
    const desc = mk({
      id: nextId(), name: `desc-${c}`, type: 'TEXT', parentId: card.id,
      x: 16, y: 56, absoluteX: card.x + 16, absoluteY: card.y + 56,
      width: 280, height: 60,
      fills: [solid(0.3, 0.3, 0.3)],
      text: text('Inter', 'Regular', 13, 18, 'Описание карточки содержит несколько строк полезного текста для пользователя.'),
    })
    card.childrenIds.push(desc.id)
    nodes.push(desc)

    // Кнопка
    const btn = mk({
      id: nextId(), name: `btn-primary-${c}`, type: 'INSTANCE', parentId: card.id,
      x: 16, y: 160, absoluteX: card.x + 16, absoluteY: card.y + 160,
      width: 120, height: 40,
      fills: [solid(0.05, 0.6, 1)],
      cornerRadius: 6,
    })
    card.childrenIds.push(btn.id)
    nodes.push(btn)

    // Мелкая иконка-кнопка (нарушение touch-target iOS)
    const icon = mk({
      id: nextId(), name: `icon-button-${c}`, type: 'INSTANCE', parentId: card.id,
      x: 280, y: 16, absoluteX: card.x + 280, absoluteY: card.y + 16,
      width: 24, height: 24,
      fills: [solid(0.6, 0.6, 0.6)],
    })
    card.childrenIds.push(icon.id)
    nodes.push(icon)
  }

  // Форма с 6 полями в одном контейнере
  const form = mk({
    id: nextId(), name: 'signup-form', type: 'FRAME', parentId: root.id,
    x: 40, y: 400, width: 400, height: 420, fills: [solid(0.98, 0.98, 0.98)], childrenIds: [],
  })
  root.childrenIds.push(form.id)
  nodes.push(form)
  for (let f = 0; f < 6; f++) {
    const field = mk({
      id: nextId(), name: `input-field-${f}`, type: 'FRAME', parentId: form.id,
      x: 16, y: 16 + f * 64, absoluteX: form.x + 16, absoluteY: form.y + 16 + f * 64,
      width: 368, height: 48, fills: [solid(1, 1, 1)],
      strokes: [{ type: 'SOLID', visible: true, weight: 1, color: { r: 0.8, g: 0.8, b: 0.8, a: 1 } }],
      strokeWeight: 1,
      cornerRadius: 4,
    })
    form.childrenIds.push(field.id)
    nodes.push(field)
  }

  // Тулбар с 10 кнопками (нарушение Хика)
  const toolbar = mk({
    id: nextId(), name: 'toolbar', type: 'FRAME', parentId: root.id,
    x: 480, y: 400, width: 640, height: 48, fills: [solid(0.95, 0.95, 0.95)], childrenIds: [],
  })
  root.childrenIds.push(toolbar.id)
  nodes.push(toolbar)
  for (let b = 0; b < 10; b++) {
    const btn = mk({
      id: nextId(), name: `btn-${b}`, type: 'INSTANCE', parentId: toolbar.id,
      x: 8 + b * 60, y: 8, absoluteX: toolbar.x + 8 + b * 60, absoluteY: toolbar.y + 8,
      width: 52, height: 32, fills: [solid(1, 1, 1)],
    })
    toolbar.childrenIds.push(btn.id)
    nodes.push(btn)
  }

  // Хедер с навигацией (6 пунктов)
  const nav = mk({
    id: nextId(), name: 'nav', type: 'FRAME', parentId: root.id,
    x: 40, y: 40, width: 1360, height: 56, fills: [solid(1, 1, 1)], childrenIds: [],
  })
  root.childrenIds.push(nav.id)
  nodes.push(nav)
  const navItems = ['Обзор', 'Продукты', 'Клиенты', 'Отчёты', 'Настройки', 'Помощь']
  for (let i = 0; i < navItems.length; i++) {
    const item = mk({
      id: nextId(), name: `nav-item-${i}`, type: 'TEXT', parentId: nav.id,
      x: 16 + i * 120, y: 20, absoluteX: nav.x + 16 + i * 120, absoluteY: nav.y + 20,
      width: 100, height: 16, fills: [solid(0.2, 0.2, 0.2)],
      text: text('Inter', 'Medium', 14, 20, navItems[i]),
    })
    nav.childrenIds.push(item.id)
    nodes.push(item)
  }

  // Несколько текстов на сетке с нарушениями
  for (let t = 0; t < 5; t++) {
    const tn = mk({
      id: nextId(), name: `caption-${t}`, type: 'TEXT', parentId: root.id,
      x: 40 + t * 130, y: 860, width: 120, height: 14,
      fills: [solid(0.5, 0.5, 0.5)],
      text: text('Inter', 'Regular', 10, 14, 'Мелкий служебный текст'), // <12px — нарушение
    })
    root.childrenIds.push(tn.id)
    nodes.push(tn)
  }

  return nodes
}

function mk(partial: Partial<SerializedNode>): SerializedNode {
  return {
    id: partial.id ?? 'x',
    name: partial.name ?? 'x',
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
    layoutMode: 'NONE',
    itemSpacing: 0,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    componentId: null,
    text: partial.text ?? null,
  }
}

function solid(r: number, g: number, b: number, a = 1) {
  return { type: 'SOLID', visible: true, opacity: 1, color: { r, g, b, a } }
}

function text(fontFamily: string, fontStyle: string, fontSize: number, lineHeight: number, characters: string) {
  return {
    fontFamily,
    fontStyle,
    fontSize,
    lineHeight,
    letterSpacing: 0,
    letterSpacingPercent: 0,
    textAlignHorizontal: 'LEFT',
    textCase: 'ORIGINAL',
    characters,
  }
}

/** Тестовый набор правил, покрывающий все 22 детектора. */
export function makeRules(): FigmaRule[] {
  const r = (id: string, detectorId: string, params: Record<string, number | string | boolean> = {}): FigmaRule => ({
    id, source: 'ui-guide',
    nameRu: id, nameEn: id,
    category: 'Иерархия', categoryEn: 'Hierarchy',
    summary: '', description: '', application: [],
    impact: 3, severity: 'warning', checkType: 'auto',
    detector: { id: detectorId as never, params },
    tags: [], docUrl: '',
  })
  return [
    r('wcag-contrast', 'contrast-wcag', { normal: 4.5, large: 3 }),
    r('color-blind-safe', 'contrast-nontext', { minRatio: 3 }),
    r('text-on-image-rule', 'text-on-image'),
    r('touch-target', 'touch-target', { ios: 44, android: 48, web: 24 }),
    r('button-hierarchy', 'button-min-size', { minWidth: 44, minHeight: 44 }),
    r('optical-alignment', 'target-spacing', { minClearance: 24 }),
    r('font-size-minimum', 'font-size-min', { min: 12 }),
    r('line-height-ratio', 'line-height', { bodyMin: 1.4, bodyMax: 1.6 }),
    r('line-length', 'line-length', { max: 90, idealMax: 75 }),
    r('type-scale', 'font-sizes-scale', { maxDistinct: 5 }),
    r('font-pairing', 'font-families', { maxFamilies: 2 }),
    r('letter-spacing-caps', 'letter-spacing', { minPct: -1, maxPct: 2.5 }),
    r('8pt-grid', 'grid-snap', { grid: 8 }),
    r('card-anatomy', 'radius-consistency', { maxVariants: 3 }),
    r('dark-borders', 'stroke-consistency', { maxWeights: 3 }),
    r('depth-layers', 'shadow-consistency', { minLevels: 3, maxLevels: 6 }),
    r('60-30-10', 'palette-size', { max: 10 }),
    r('dark-avoid-pure-black', 'dark-theme-purity'),
    r('label-above', 'missing-label'),
    r('disabled-state', 'disabled-visible', { minContrast: 3 }),
    r('focus-states', 'focus-visible'),
    r('hicks-law', 'choice-count', { max: 7 }),
  ]
}
