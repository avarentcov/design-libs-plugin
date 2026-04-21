import { describe, expect, it } from 'vitest'
import { buildRecommendation, computePriority } from '../recommendation'
import type { FigmaRule } from '../rules-types'

const rule: FigmaRule = {
  id: 'wcag-contrast',
  source: 'ui-guide',
  nameRu: 'WCAG-контраст',
  nameEn: 'WCAG contrast',
  category: 'Цвет и контраст',
  categoryEn: 'Color & Contrast',
  summary: 'Текст должен иметь достаточный контраст с фоном.',
  description: '',
  application: ['Проверяйте контраст в светлой и тёмной теме', 'Не снижайте alpha текста ниже 0.87'],
  example: '#212121 на #FFFFFF — 16:1',
  antiPattern: '#999 на #CCC — 1.6:1',
  impact: 5,
  severity: 'error',
  checkType: 'auto',
  detector: { id: 'contrast-wcag', params: { normal: 4.5, large: 3 } },
  tags: [],
  docUrl: 'https://example.com/wcag-contrast',
}

describe('computePriority', () => {
  it('error × impact 5 → P5', () => {
    expect(computePriority('error', 5)).toBe(5)
  })
  it('warning × impact 3 → P2', () => {
    expect(computePriority('warning', 3)).toBe(2)
  })
  it('info × impact 1 → P1', () => {
    expect(computePriority('info', 1)).toBe(1)
  })
  it('clamp в пределах 1..5', () => {
    expect(computePriority('error', 99)).toBe(5)
    expect(computePriority('info', 0)).toBe(1)
  })
})

describe('buildRecommendation', () => {
  it('автозаполняет rationale, examples, docUrl из правила', () => {
    const r = buildRecommendation({
      rule,
      detectorId: 'contrast-wcag',
      origin: 'auto',
      target: { nodeId: 'node1', nodeName: 'Header' },
      title: 'Низкий контраст',
      summary: 'Контраст 3:1.',
      fix: { steps: ['Затемните текст.'] },
      standard: 'WCAG 2.2 §1.4.3',
    })
    expect(r.rationale.ruleName).toBe('WCAG-контраст')
    expect(r.rationale.category).toBe('Цвет и контраст')
    expect(r.rationale.why).toContain('контраст')
    expect(r.rationale.standard).toBe('WCAG 2.2 §1.4.3')
    expect(r.examples?.good).toContain('16:1')
    expect(r.examples?.bad).toContain('1.6:1')
    expect(r.docUrl).toBe(rule.docUrl)
    expect(r.priority).toBe(5) // error + impact 5
    expect(r.origin).toBe('auto')
  })

  it('fix.steps fallback на rule.application при пустом массиве', () => {
    const r = buildRecommendation({
      rule,
      origin: 'ai',
      target: { nodeId: 'x', nodeName: 'X' },
      title: 't',
      summary: 's',
      fix: { steps: [] },
    })
    expect(r.fix.steps.length).toBeGreaterThan(0)
    expect(r.fix.steps[0]).toContain('контраст')
  })

  it('id стабилен между одинаковыми входами', () => {
    const input = {
      rule,
      origin: 'auto' as const,
      target: { nodeId: 'n1', nodeName: 'N' },
      title: 'T',
      summary: 'S',
      fix: { steps: ['a'] },
      measurements: { x: 1 },
    }
    const a = buildRecommendation(input)
    const b = buildRecommendation(input)
    expect(a.id).toBe(b.id)
  })

  it('id меняется при смене summary', () => {
    const base = {
      rule,
      origin: 'auto' as const,
      target: { nodeId: 'n1', nodeName: 'N' },
      title: 'T',
      fix: { steps: ['a'] },
    }
    const a = buildRecommendation({ ...base, summary: 'one' })
    const b = buildRecommendation({ ...base, summary: 'two' })
    expect(a.id).not.toBe(b.id)
  })
})
