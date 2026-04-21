import { describe, expect, it } from 'vitest'
import { BUNDLED_AT, BUNDLED_RULES, BUNDLED_SOURCE } from '../rules-bundle'

describe('rules-bundle', () => {
  it('содержит ≥ 50 правил', () => {
    expect(BUNDLED_RULES.count).toBeGreaterThanOrEqual(50)
    expect(BUNDLED_RULES.rules.length).toBe(BUNDLED_RULES.count)
  })

  it('каждое правило имеет id, severity, checkType и docUrl', () => {
    for (const r of BUNDLED_RULES.rules.slice(0, 20)) {
      expect(typeof r.id).toBe('string')
      expect(r.id.length).toBeGreaterThan(0)
      expect(['error', 'warning', 'info']).toContain(r.severity)
      expect(['auto', 'ai', 'manual']).toContain(r.checkType)
      expect(r.docUrl).toMatch(/^https?:\/\//)
    }
  })

  it('хотя бы одно правило имеет auto-детектор', () => {
    const auto = BUNDLED_RULES.rules.filter((r) => r.checkType === 'auto')
    expect(auto.length).toBeGreaterThan(10)
    expect(auto[0].detector?.id).toBeTruthy()
  })

  it('meta-поля присутствуют', () => {
    expect(BUNDLED_SOURCE).toBeTruthy()
    expect(BUNDLED_AT).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(BUNDLED_RULES.version).toMatch(/^\d/)
    expect(BUNDLED_RULES.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})
