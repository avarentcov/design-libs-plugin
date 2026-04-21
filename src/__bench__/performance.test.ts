import { describe, expect, it } from 'vitest'
import { runAutoAudit } from '../detectors'
import { DEFAULT_SETTINGS } from '../detectors/types'
import { makeFixture, makeRules } from './fixture'

describe('Бенчмарк: прогон всех 22 детекторов на фикстуре', () => {
  it('p95 < 500 мс на 10 прогонах', () => {
    const nodes = makeFixture()
    const rules = makeRules()
    expect(nodes.length).toBeGreaterThanOrEqual(50)

    // warm-up
    runAutoAudit({ nodes, settings: DEFAULT_SETTINGS }, rules)

    const runs = 10
    const times: number[] = []
    let totalIssues = 0
    for (let i = 0; i < runs; i++) {
      const start = performance.now()
      const issues = runAutoAudit({ nodes, settings: DEFAULT_SETTINGS }, rules)
      times.push(performance.now() - start)
      totalIssues += issues.length
    }
    times.sort((a, b) => a - b)
    const p95 = times[Math.floor(times.length * 0.95) - 1] ?? times[times.length - 1]
    const mean = times.reduce((s, x) => s + x, 0) / times.length

    // отчёт в stdout vitest
    console.log(
      `[bench] nodes=${nodes.length} rules=${rules.length} runs=${runs} ` +
      `mean=${mean.toFixed(2)}ms p95=${p95.toFixed(2)}ms issues/run≈${(totalIssues / runs).toFixed(0)}`,
    )

    expect(p95).toBeLessThan(500)
    expect(totalIssues).toBeGreaterThan(0) // фикстура задумана с нарушениями
  })
})
