import { describe, expect, it } from 'vitest'
import { contrastWcag } from '../contrast'
import { touchTarget } from '../targets'
import { fontSizeMin } from '../typography'
import { missingLabel } from '../forms'
import { choiceCount } from '../cognitive'
import { DEFAULT_SETTINGS } from '../types'
import { mkNode, rule, solid } from './helpers'

describe('contrast-wcag', () => {
  const params = { normal: 4.5, large: 3, strictNormal: 7, strictLarge: 4.5 }

  it('чёрный на тёмно-сером — error (<4.5)', () => {
    const bg = mkNode({ id: 'bg', fills: [solid(0.4, 0.4, 0.4)] })
    const t = mkNode({
      id: 't', type: 'TEXT', parentId: 'bg',
      fills: [solid(0, 0, 0)],
      text: { fontFamily: 'Inter', fontStyle: 'Regular', fontSize: 14, lineHeight: 20, letterSpacing: 0, letterSpacingPercent: 0, textAlignHorizontal: 'LEFT', textCase: 'ORIGINAL', characters: 'Hi' },
    })
    const issues = contrastWcag({ nodes: [bg, t], rule: rule('wcag-contrast', 'contrast-wcag', params, 'error'), settings: DEFAULT_SETTINGS })
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('error')
  })

  it('#666 на белом — warning (AA ok ~5.7:1, AAA нет)', () => {
    const bg = mkNode({ id: 'bg', fills: [solid(1, 1, 1)] })
    const t = mkNode({
      id: 't', type: 'TEXT', parentId: 'bg',
      fills: [solid(0.4, 0.4, 0.4)], // ratio ≈ 5.7 — больше 4.5, меньше 7
      text: { fontFamily: 'Inter', fontStyle: 'Regular', fontSize: 14, lineHeight: 20, letterSpacing: 0, letterSpacingPercent: 0, textAlignHorizontal: 'LEFT', textCase: 'ORIGINAL', characters: 'Hi' },
    })
    const issues = contrastWcag({ nodes: [bg, t], rule: rule('wcag-contrast', 'contrast-wcag', params), settings: DEFAULT_SETTINGS })
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('warning')
  })

  it('чёрный на белом — ок (AAA прошёл)', () => {
    const bg = mkNode({ id: 'bg', fills: [solid(1, 1, 1)] })
    const t = mkNode({
      id: 't', type: 'TEXT', parentId: 'bg',
      fills: [solid(0, 0, 0)],
      text: { fontFamily: 'Inter', fontStyle: 'Regular', fontSize: 14, lineHeight: 20, letterSpacing: 0, letterSpacingPercent: 0, textAlignHorizontal: 'LEFT', textCase: 'ORIGINAL', characters: 'Hi' },
    })
    const issues = contrastWcag({ nodes: [bg, t], rule: rule('wcag-contrast', 'contrast-wcag', params), settings: DEFAULT_SETTINGS })
    expect(issues).toHaveLength(0)
  })
})

describe('touch-target', () => {
  const params = { ios: 44, android: 48, web: 44, strictIos: 48, strictAndroid: 56, strictWeb: 48 }

  it('30×30 на iOS — error (меньше 44 hardMin)', () => {
    const btn = mkNode({ id: 'btn', name: 'btn-primary', width: 30, height: 30 })
    const issues = touchTarget({ nodes: [btn], rule: rule('touch-target', 'touch-target', params, 'error'), settings: { ...DEFAULT_SETTINGS, platform: 'ios' } })
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('error')
    expect(issues[0].title).toContain('iOS')
    expect(issues[0].measurements?.hardMin).toBe(44)
  })

  it('46×46 на iOS — warning (прошёл 44, но не 48 strict)', () => {
    const btn = mkNode({ id: 'btn', name: 'btn-primary', width: 46, height: 46 })
    const issues = touchTarget({ nodes: [btn], rule: rule('touch-target', 'touch-target', params), settings: { ...DEFAULT_SETTINGS, platform: 'ios' } })
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('warning')
  })

  it('48×48 на iOS — ок', () => {
    const btn = mkNode({ id: 'btn', name: 'btn-primary', width: 48, height: 48 })
    const issues = touchTarget({ nodes: [btn], rule: rule('touch-target', 'touch-target', params), settings: { ...DEFAULT_SETTINGS, platform: 'ios' } })
    expect(issues).toHaveLength(0)
  })

  it('не-интерактивный фрейм игнорируется', () => {
    const box = mkNode({ id: 'box', name: 'decor-box', width: 10, height: 10 })
    const issues = touchTarget({ nodes: [box], rule: rule('touch-target', 'touch-target', params), settings: { ...DEFAULT_SETTINGS, platform: 'ios' } })
    expect(issues).toHaveLength(0)
  })
})

describe('font-size-min', () => {
  const base = (fontSize: number) =>
    mkNode({
      id: 't', type: 'TEXT',
      text: { fontFamily: 'Inter', fontStyle: 'Regular', fontSize, lineHeight: fontSize * 1.4, letterSpacing: 0, letterSpacingPercent: 0, textAlignHorizontal: 'LEFT', textCase: 'ORIGINAL', characters: 'x' },
    })

  it('10 px — error (ниже softMin 12)', () => {
    const issues = fontSizeMin({ nodes: [base(10)], rule: rule('font-size-minimum', 'font-size-min', { min: 14, softMin: 12 }), settings: DEFAULT_SETTINGS })
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('error')
  })
  it('13 px — warning (меньше min 14, но не ниже softMin)', () => {
    const issues = fontSizeMin({ nodes: [base(13)], rule: rule('font-size-minimum', 'font-size-min', { min: 14, softMin: 12 }), settings: DEFAULT_SETTINGS })
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('warning')
  })
  it('14 px — ок', () => {
    const issues = fontSizeMin({ nodes: [base(14)], rule: rule('font-size-minimum', 'font-size-min', { min: 14, softMin: 12 }), settings: DEFAULT_SETTINGS })
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
  const params = { soft: 5, max: 7, hardMax: 9 }

  it('10 кнопок — error (больше hardMax)', () => {
    const parent = mkNode({ id: 'p', name: 'toolbar' })
    const btns = Array.from({ length: 10 }, (_, i) => mkNode({ id: `b${i}`, name: `btn-${i}`, parentId: 'p' }))
    parent.childrenIds = btns.map((b) => b.id)
    const issues = choiceCount({ nodes: [parent, ...btns], rule: rule('hicks-law', 'choice-count', params), settings: DEFAULT_SETTINGS })
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('error')
    expect(issues[0].measurements?.count).toBe(10)
  })

  it('8 кнопок — warning (между max и hardMax)', () => {
    const parent = mkNode({ id: 'p', name: 'toolbar' })
    const btns = Array.from({ length: 8 }, (_, i) => mkNode({ id: `b${i}`, name: `btn-${i}`, parentId: 'p' }))
    parent.childrenIds = btns.map((b) => b.id)
    const issues = choiceCount({ nodes: [parent, ...btns], rule: rule('hicks-law', 'choice-count', params), settings: DEFAULT_SETTINGS })
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('warning')
  })

  it('6 кнопок — info (выше soft, в пределах max)', () => {
    const parent = mkNode({ id: 'p' })
    const btns = Array.from({ length: 6 }, (_, i) => mkNode({ id: `b${i}`, name: `btn-${i}`, parentId: 'p' }))
    parent.childrenIds = btns.map((b) => b.id)
    const issues = choiceCount({ nodes: [parent, ...btns], rule: rule('hicks-law', 'choice-count', params), settings: DEFAULT_SETTINGS })
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('info')
  })

  it('5 кнопок — ок', () => {
    const parent = mkNode({ id: 'p' })
    const btns = Array.from({ length: 5 }, (_, i) => mkNode({ id: `b${i}`, name: `btn-${i}`, parentId: 'p' }))
    parent.childrenIds = btns.map((b) => b.id)
    const issues = choiceCount({ nodes: [parent, ...btns], rule: rule('hicks-law', 'choice-count', params), settings: DEFAULT_SETTINGS })
    expect(issues).toHaveLength(0)
  })
})
