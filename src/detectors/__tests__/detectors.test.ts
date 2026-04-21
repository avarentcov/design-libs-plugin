import { describe, expect, it } from 'vitest'
import { contrastWcag } from '../contrast'
import { touchTarget } from '../targets'
import { fontSizeMin } from '../typography'
import { gridSnap } from '../layout'
import { missingLabel } from '../forms'
import { choiceCount } from '../cognitive'
import { DEFAULT_SETTINGS } from '../types'
import { mkNode, rule, solid } from './helpers'

describe('contrast-wcag', () => {
  it('флагает чёрный текст на тёмно-сером фоне (<4.5:1)', () => {
    const bg = mkNode({ id: 'bg', fills: [solid(0.4, 0.4, 0.4)] })
    const t = mkNode({
      id: 't', type: 'TEXT', parentId: 'bg',
      fills: [solid(0, 0, 0)],
      text: { fontFamily: 'Inter', fontStyle: 'Regular', fontSize: 14, lineHeight: 20, letterSpacing: 0, letterSpacingPercent: 0, textAlignHorizontal: 'LEFT', textCase: 'ORIGINAL', characters: 'Hi' },
    })
    const issues = contrastWcag({ nodes: [bg, t], rule: rule('wcag-contrast', 'contrast-wcag', { normal: 4.5, large: 3 }, 'error'), settings: DEFAULT_SETTINGS })
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('error')
  })

  it('пропускает чёрный текст на белом фоне', () => {
    const bg = mkNode({ id: 'bg', fills: [solid(1, 1, 1)] })
    const t = mkNode({
      id: 't', type: 'TEXT', parentId: 'bg',
      fills: [solid(0, 0, 0)],
      text: { fontFamily: 'Inter', fontStyle: 'Regular', fontSize: 14, lineHeight: 20, letterSpacing: 0, letterSpacingPercent: 0, textAlignHorizontal: 'LEFT', textCase: 'ORIGINAL', characters: 'Hi' },
    })
    const issues = contrastWcag({ nodes: [bg, t], rule: rule('wcag-contrast', 'contrast-wcag'), settings: DEFAULT_SETTINGS })
    expect(issues).toHaveLength(0)
  })

  it('крупный жирный текст (18px bold) проходит с более мягким порогом 3:1', () => {
    const bg = mkNode({ id: 'bg', fills: [solid(0.7, 0.7, 0.7)] })
    const t = mkNode({
      id: 't', type: 'TEXT', parentId: 'bg',
      fills: [solid(0.1, 0.1, 0.1)],
      text: { fontFamily: 'Inter', fontStyle: 'Bold', fontSize: 20, lineHeight: 28, letterSpacing: 0, letterSpacingPercent: 0, textAlignHorizontal: 'LEFT', textCase: 'ORIGINAL', characters: 'Hi' },
    })
    const issues = contrastWcag({ nodes: [bg, t], rule: rule('wcag-contrast', 'contrast-wcag'), settings: DEFAULT_SETTINGS })
    expect(issues).toHaveLength(0)
  })
})

describe('touch-target', () => {
  it('кнопка 30×30 на iOS меньше 44px — ошибка', () => {
    const btn = mkNode({ id: 'btn', name: 'btn-primary', width: 30, height: 30 })
    const issues = touchTarget({ nodes: [btn], rule: rule('touch-target', 'touch-target', { ios: 44, android: 48, web: 24 }, 'error'), settings: { ...DEFAULT_SETTINGS, platform: 'ios' } })
    expect(issues).toHaveLength(1)
    expect(issues[0].measurements?.min).toBe(44)
    expect(issues[0].title).toContain('iOS')
    expect(issues[0].fix.expected).toBe('44×44 px')
  })

  it('та же кнопка на web (min 24) — ок', () => {
    const btn = mkNode({ id: 'btn', name: 'btn-primary', width: 30, height: 30 })
    const issues = touchTarget({ nodes: [btn], rule: rule('touch-target', 'touch-target', { ios: 44, android: 48, web: 24 }), settings: { ...DEFAULT_SETTINGS, platform: 'web' } })
    expect(issues).toHaveLength(0)
  })

  it('не-интерактивный фрейм игнорируется', () => {
    const box = mkNode({ id: 'box', name: 'decor-box', width: 10, height: 10 })
    const issues = touchTarget({ nodes: [box], rule: rule('touch-target', 'touch-target'), settings: { ...DEFAULT_SETTINGS, platform: 'ios' } })
    expect(issues).toHaveLength(0)
  })
})

describe('font-size-min', () => {
  const base = (fontSize: number) =>
    mkNode({
      id: 't', type: 'TEXT',
      text: { fontFamily: 'Inter', fontStyle: 'Regular', fontSize, lineHeight: fontSize * 1.4, letterSpacing: 0, letterSpacingPercent: 0, textAlignHorizontal: 'LEFT', textCase: 'ORIGINAL', characters: 'x' },
    })

  it('10 px — warning', () => {
    const issues = fontSizeMin({ nodes: [base(10)], rule: rule('font-size-minimum', 'font-size-min', { min: 12 }), settings: DEFAULT_SETTINGS })
    expect(issues).toHaveLength(1)
  })
  it('12 px — ок', () => {
    const issues = fontSizeMin({ nodes: [base(12)], rule: rule('font-size-minimum', 'font-size-min', { min: 12 }), settings: DEFAULT_SETTINGS })
    expect(issues).toHaveLength(0)
  })
})

describe('grid-snap', () => {
  it('координата 13 на сетке 8 — флаг', () => {
    const root = mkNode({ id: 'r' })
    const n = mkNode({ id: 'n', x: 13, y: 0, parentId: 'r' })
    const issues = gridSnap({ nodes: [root, n], rule: rule('8pt-grid', 'grid-snap', { grid: 8 }), settings: DEFAULT_SETTINGS })
    expect(issues).toHaveLength(1)
  })
  it('координата 16 на сетке 8 — ок', () => {
    const root = mkNode({ id: 'r' })
    const n = mkNode({ id: 'n', x: 16, y: 8, parentId: 'r' })
    const issues = gridSnap({ nodes: [root, n], rule: rule('8pt-grid', 'grid-snap', { grid: 8 }), settings: DEFAULT_SETTINGS })
    expect(issues).toHaveLength(0)
  })
})

describe('missing-label', () => {
  it('input без подписи — ошибка', () => {
    const parent = mkNode({ id: 'p', childrenIds: ['f'] })
    const field = mkNode({ id: 'f', name: 'input-email', parentId: 'p', absoluteY: 100, width: 200, height: 40 })
    const issues = missingLabel({ nodes: [parent, field], rule: rule('label-above', 'missing-label', {}, 'error'), settings: DEFAULT_SETTINGS })
    expect(issues).toHaveLength(1)
  })

  it('input с подписью сверху — ок', () => {
    const parent = mkNode({ id: 'p', childrenIds: ['lbl', 'f'] })
    const label = mkNode({
      id: 'lbl', name: 'Email', type: 'TEXT', parentId: 'p', absoluteY: 80, height: 16,
      text: { fontFamily: 'Inter', fontStyle: 'Regular', fontSize: 12, lineHeight: 16, letterSpacing: 0, letterSpacingPercent: 0, textAlignHorizontal: 'LEFT', textCase: 'ORIGINAL', characters: 'Email' },
    })
    const field = mkNode({ id: 'f', name: 'input-email', parentId: 'p', absoluteY: 100, width: 200, height: 40 })
    const issues = missingLabel({ nodes: [parent, label, field], rule: rule('label-above', 'missing-label'), settings: DEFAULT_SETTINGS })
    expect(issues).toHaveLength(0)
  })
})

describe('choice-count (закон Хика)', () => {
  it('9 кнопок в одном контейнере — предупреждение', () => {
    const parent = mkNode({ id: 'p', name: 'toolbar' })
    const btns = Array.from({ length: 9 }, (_, i) => mkNode({ id: `b${i}`, name: `btn-${i}`, parentId: 'p' }))
    parent.childrenIds = btns.map((b) => b.id)
    const issues = choiceCount({ nodes: [parent, ...btns], rule: rule('hicks-law', 'choice-count', { max: 7 }), settings: DEFAULT_SETTINGS })
    expect(issues).toHaveLength(1)
    expect(issues[0].measurements?.count).toBe(9)
    expect(issues[0].fix.steps.length).toBeGreaterThan(0)
  })

  it('5 кнопок — ок', () => {
    const parent = mkNode({ id: 'p' })
    const btns = Array.from({ length: 5 }, (_, i) => mkNode({ id: `b${i}`, name: `btn-${i}`, parentId: 'p' }))
    parent.childrenIds = btns.map((b) => b.id)
    const issues = choiceCount({ nodes: [parent, ...btns], rule: rule('hicks-law', 'choice-count', { max: 7 }), settings: DEFAULT_SETTINGS })
    expect(issues).toHaveLength(0)
  })
})
