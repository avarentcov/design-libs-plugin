import { afterEach, describe, expect, it, vi } from 'vitest'
import { runVisionAudit } from '../claude'
import type { FigmaRule } from '../../shared/rules-types'

const tinyPng =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII='

const ruleA: FigmaRule = {
  id: 'visual-weight',
  source: 'ui-guide',
  nameRu: 'Визуальный вес',
  nameEn: 'Visual Weight',
  category: 'Иерархия',
  categoryEn: 'Hierarchy',
  summary: 'Иерархия через размер и контраст.',
  description: '',
  application: [],
  impact: 3,
  severity: 'warning',
  checkType: 'ai',
  tags: [],
  docUrl: 'https://example.com/visual-weight',
}

afterEach(() => {
  vi.restoreAllMocks()
})

function mockFetchOnce(body: object, init: Partial<ResponseInit> = {}) {
  const fn = vi.fn().mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status: init.status ?? 200,
      headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    }),
  )
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('Claude runVisionAudit', () => {
  it('парсит корректный tool-use ответ', async () => {
    const fetchMock = mockFetchOnce({
      content: [
        {
          type: 'tool_use',
          name: 'report_issues',
          input: {
            issues: [
              {
                ruleId: 'visual-weight',
                severity: 'warning',
                title: 'CTA теряется',
                summary: 'Кнопка CTA сливается с заголовками по весу.',
                nodeHint: 'правый верх',
                fix: { steps: ['Увеличьте кнопку.', 'Добавьте контраст.'], expected: 'явный акцент' },
              },
              { ruleId: 'visual-weight', severity: 'info', title: 'Пусто', summary: '', fix: { steps: ['фикс'] } },
              { ruleId: 'visual-weight', severity: 'info', title: 'Без шагов', summary: 'Есть проблема', fix: { steps: [] } },
              { ruleId: 'unknown-rule', severity: 'error', title: 'x', summary: 'y', fix: { steps: ['z'] } },
            ],
            summary: 'Всё ок, кроме CTA.',
          },
        },
      ],
      usage: { input_tokens: 123, output_tokens: 45 },
    })
    const res = await runVisionAudit({ apiKey: 'sk-test', pngBase64: tinyPng, rules: [ruleA] })
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(res.issues).toHaveLength(1)
    expect(res.issues[0].title).toContain('CTA')
    expect(res.issues[0].fix.steps).toHaveLength(2)
    expect(res.summary).toBe('Всё ок, кроме CTA.')
    expect(res.usage).toEqual({ inputTokens: 123, outputTokens: 45 })
  })

  it('шлёт правильные заголовки и tool_choice', async () => {
    const fetchMock = mockFetchOnce({
      content: [{ type: 'tool_use', name: 'report_issues', input: { issues: [] } }],
    })
    await runVisionAudit({ apiKey: 'sk-test', pngBase64: tinyPng, rules: [ruleA] })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    const headers = (init as RequestInit).headers as Record<string, string>
    expect(headers['x-api-key']).toBe('sk-test')
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.tool_choice).toEqual({ type: 'tool', name: 'report_issues' })
  })

  it('бросает на 4xx с сообщением', async () => {
    mockFetchOnce(
      { error: { type: 'authentication_error', message: 'invalid x-api-key' } },
      { status: 401 },
    )
    await expect(
      runVisionAudit({ apiKey: 'bad', pngBase64: tinyPng, rules: [ruleA] }),
    ).rejects.toThrow(/invalid x-api-key/)
  })

  it('отказывает при слишком большом изображении', async () => {
    const huge = 'A'.repeat(2_000_000)
    await expect(
      runVisionAudit({ apiKey: 'sk-test', pngBase64: huge, rules: [ruleA] }),
    ).rejects.toThrow(/1 МБ/)
  })

  it('требует apiKey и pngBase64', async () => {
    await expect(runVisionAudit({ apiKey: '', pngBase64: tinyPng, rules: [ruleA] })).rejects.toThrow(/API-ключ/)
    await expect(runVisionAudit({ apiKey: 'k', pngBase64: '', rules: [ruleA] })).rejects.toThrow(/PNG/)
  })
})
