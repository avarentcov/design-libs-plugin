import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FigmaRule, FigmaRulesResponse, Severity } from '../shared/rules-types'
import type { SerializedNode } from '../shared/serialize'
import { postToSandbox, type SandboxToUi, type UiToSandbox } from '../shared/messages'
import type { Platform } from '../detectors/types'
import { runAutoAudit } from '../detectors'
import { buildRecommendation, type Recommendation } from '../shared/recommendation'
import { BUNDLED_AT, BUNDLED_RULES } from '../shared/rules-bundle'
import { DEFAULT_MODEL, type ClaudeModel, runVisionAudit } from '../vision/claude'
import { DEFAULT_SERVER_URL, runServerVisionAudit, ServerAuditError } from '../vision/server'
import {
  PLUGIN_DATA_KEYS,
  STORAGE_KEYS,
  getClientStorage,
  getPluginData,
  installStorageBridge,
  readJson,
  setClientStorage,
  setPluginData,
  writeJson,
} from '../storage/client'
import { SettingsScreen, type SettingsValue } from '../screens/SettingsScreen'
import { IssuesScreen } from '../screens/IssuesScreen'
import { LearnScreen } from '../screens/LearnScreen'
import { IgnoredScreen, type IgnoredEntry } from '../screens/IgnoredScreen'
import { computeScore, renderFixSnippet, renderMarkdownReport } from '../screens/summary'
import { colors } from './theme'
import { t } from './i18n/ru'
import { copyToClipboard } from './clipboard'

const DEFAULT_RULES_URL = 'https://design-libs.vercel.app/api/figma-rules/v1'

type Tab = 'issues' | 'learn' | 'settings' | 'ignored'

const DEFAULT_SETTINGS: SettingsValue = {
  apiKey: '',
  model: DEFAULT_MODEL,
  platform: 'web',
  gridSize: 8,
  darkTheme: false,
  apiUrl: DEFAULT_RULES_URL,
  aiMode: 'server',
  aiServerUrl: DEFAULT_SERVER_URL,
}

interface CachedRules {
  fetchedAt: number
  payload: FigmaRulesResponse
}

type RulesSource = 'bundle' | 'cache' | 'api'

export function App() {
  const [tab, setTab] = useState<Tab>('issues')
  const [docName, setDocName] = useState('—')
  const [selection, setSelection] = useState<SerializedNode[]>([])
  const [rules, setRules] = useState<FigmaRule[]>(BUNDLED_RULES.rules)
  const [rulesVersion, setRulesVersion] = useState<string>(BUNDLED_RULES.version)
  const [rulesUpdatedAt, setRulesUpdatedAt] = useState<string>(BUNDLED_RULES.updatedAt)
  const [rulesSource, setRulesSource] = useState<RulesSource>('bundle')
  const [cachedAt, setCachedAt] = useState<string | null>(null)
  const [settings, setSettings] = useState<SettingsValue>(DEFAULT_SETTINGS)
  const [issues, setIssues] = useState<Recommendation[]>([])
  const [ignored, setIgnored] = useState<IgnoredEntry[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [isAiRunning, setIsAiRunning] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const notify = useCallback((message: string, error = false) => {
    postToSandbox({ type: 'notify', message, error })
    setToast(message)
    setTimeout(() => setToast(null), 2000)
  }, [])

  const applyPayload = useCallback((payload: FigmaRulesResponse, source: RulesSource, fetchedAt?: number) => {
    setRules(payload.rules)
    setRulesVersion(payload.version)
    setRulesUpdatedAt(payload.updatedAt)
    setRulesSource(source)
    if (fetchedAt) setCachedAt(new Date(fetchedAt).toLocaleString('ru-RU'))
  }, [])

  /** Тихое обновление: пытаемся через API, молчим при сетевой ошибке. */
  const refreshRules = useCallback(async (url: string, verbose: boolean) => {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as FigmaRulesResponse
      if (!json?.count || !Array.isArray(json?.rules)) throw new Error('Invalid payload')
      const now = Date.now()
      await writeJson(setClientStorage, STORAGE_KEYS.rulesCache, { fetchedAt: now, payload: json } satisfies CachedRules)
      applyPayload(json, 'api', now)
      if (verbose) notify(`Загружено правил: ${json.count}`)
      else if (json.updatedAt !== rulesUpdatedAt) notify('Каталог обновлён')
    } catch (err) {
      if (verbose) notify(`${t.errors.fetchRulesFailed} ${err instanceof Error ? err.message : ''}`, true)
      // иначе — молча, остаёмся на bundle/cache
    }
  }, [applyPayload, notify, rulesUpdatedAt])

  /** Принудительная перезагрузка из настроек. */
  const loadRules = useCallback(async (_force: boolean, urlOverride?: string) => {
    const url = urlOverride ?? DEFAULT_RULES_URL
    await refreshRules(url, true)
  }, [refreshRules])

  const loadIgnored = useCallback(async () => {
    const list = await readJson<IgnoredEntry[]>(getPluginData, PLUGIN_DATA_KEYS.ignored, [])
    setIgnored(list)
  }, [])

  useEffect(() => {
    const off = installStorageBridge()
    function onMessage(e: MessageEvent) {
      const msg = e.data?.pluginMessage as SandboxToUi | undefined
      if (!msg) return
      switch (msg.type) {
        case 'init':
          setDocName(msg.documentName)
          break
        case 'selection-changed':
          setSelection(msg.payload.nodes)
          break
        default:
          break
      }
    }
    window.addEventListener('message', onMessage)
    postToSandbox({ type: 'ui-ready' } satisfies UiToSandbox)
    ;(async () => {
      const savedSettings = await readJson<Partial<SettingsValue>>(getClientStorage, STORAGE_KEYS.settings, DEFAULT_SETTINGS)
      const savedKey = (await getClientStorage(STORAGE_KEYS.apiKey)) ?? ''
      const effective: SettingsValue = { ...DEFAULT_SETTINGS, ...savedSettings, apiKey: savedKey }
      setSettings(effective)
      await loadIgnored()

      // 1. Если в clientStorage свежий кеш новее bundle'а — подставляем его.
      const cached = await readJson<CachedRules | null>(getClientStorage, STORAGE_KEYS.rulesCache, null)
      if (cached?.payload?.updatedAt && cached.payload.updatedAt >= BUNDLED_RULES.updatedAt) {
        applyPayload(cached.payload, 'cache', cached.fetchedAt)
      }
      // 2. В фоне — тихий refresh с API.
      const url = effective.apiUrl || DEFAULT_RULES_URL
      setTimeout(() => { void refreshRules(url, false) }, 0)
    })()
    return () => {
      window.removeEventListener('message', onMessage)
      off()
    }
  }, [applyPayload, loadIgnored, refreshRules])

  const canRun = selection.length > 0 && rules.length > 0
  const canRunAi = canRun && (settings.aiMode === 'server' || settings.apiKey.trim().length > 0)

  const ignoredIds = useMemo(() => new Set(ignored.map((e) => e.id)), [ignored])

  const runAudit = useCallback(() => {
    if (!canRun) return
    setIsRunning(true)
    try {
      const recs = runAutoAudit(
        {
          nodes: selection,
          settings: { platform: settings.platform as Platform, gridSize: settings.gridSize, darkTheme: settings.darkTheme },
        },
        rules,
      )
      setIssues(recs.filter((r) => !ignoredIds.has(r.id)))
    } finally {
      setIsRunning(false)
    }
  }, [canRun, selection, settings, rules, ignoredIds])

  const runAi = useCallback(async () => {
    if (!canRunAi) {
      notify(settings.aiMode === 'byok' ? t.errors.apiKeyMissing : 'Нечего проверять.', true)
      return
    }
    setIsAiRunning(true)
    const requestId = `exp-${Date.now()}`
    const firstId = selection[0]?.id
    if (!firstId) { setIsAiRunning(false); return }
    try {
      const png = await new Promise<string>((resolve, reject) => {
        const onMsg = (e: MessageEvent) => {
          const m = e.data?.pluginMessage as SandboxToUi | undefined
          if (!m) return
          if (m.type === 'export-result' && m.requestId === requestId) {
            window.removeEventListener('message', onMsg)
            resolve(m.pngBase64)
          } else if (m.type === 'export-error' && m.requestId === requestId) {
            window.removeEventListener('message', onMsg)
            reject(new Error(m.error))
          }
        }
        window.addEventListener('message', onMsg)
        postToSandbox({ type: 'export-frame', nodeId: firstId, scale: 2, requestId })
        setTimeout(() => reject(new Error('Timeout экспорта')), 8000)
      })
      const aiRules = rules.filter((r) => r.checkType === 'ai').slice(0, 40)
      let res
      if (settings.aiMode === 'server') {
        try {
          res = await runServerVisionAudit({
            serverUrl: settings.aiServerUrl || DEFAULT_SERVER_URL,
            model: settings.model as ClaudeModel,
            pngBase64: png,
            rules: aiRules,
          })
        } catch (err) {
          if (err instanceof ServerAuditError && err.code === 'ai_rate_limit' && settings.apiKey) {
            notify('Серверный лимит — пробую с вашим ключом…')
            res = await runVisionAudit({
              apiKey: settings.apiKey,
              model: settings.model as ClaudeModel,
              pngBase64: png,
              rules: aiRules,
            })
          } else {
            throw err
          }
        }
      } else {
        res = await runVisionAudit({
          apiKey: settings.apiKey,
          model: settings.model as ClaudeModel,
          pngBase64: png,
          rules: aiRules,
        })
      }
      const rulesById = new Map(rules.map((r) => [r.id, r]))
      const firstNode = selection[0]
      const aiRecs: Recommendation[] = []
      for (const ai of res.issues) {
        const rule = rulesById.get(ai.ruleId)
        if (!rule) continue
        aiRecs.push(
          buildRecommendation({
            rule,
            origin: 'ai',
            severity: ai.severity,
            target: {
              nodeId: firstNode?.id ?? firstId,
              nodeName: firstNode?.name ?? 'layer',
              hint: ai.nodeHint,
            },
            title: ai.title,
            summary: ai.summary,
            fix: { steps: ai.fix.steps, expected: ai.fix.expected },
          }),
        )
      }
      setIssues((prev) => {
        const withoutAi = prev.filter((p) => p.origin !== 'ai')
        return [...withoutAi, ...aiRecs.filter((r) => !ignoredIds.has(r.id))]
      })
      notify(`AI добавил: ${aiRecs.length}${res.usage ? ` · tokens ${res.usage.inputTokens}/${res.usage.outputTokens}` : ''}`)
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), true)
    } finally {
      setIsAiRunning(false)
    }
  }, [canRunAi, selection, settings, rules, ignoredIds, notify])

  const saveSettings = useCallback(async (v: SettingsValue) => {
    const { apiKey, ...rest } = v
    const urlChanged = (v.apiUrl || DEFAULT_RULES_URL) !== (settings.apiUrl || DEFAULT_RULES_URL)
    await writeJson(setClientStorage, STORAGE_KEYS.settings, rest)
    await setClientStorage(STORAGE_KEYS.apiKey, apiKey || null)
    setSettings(v)
    notify('Настройки сохранены')
    if (urlChanged) {
      await setClientStorage(STORAGE_KEYS.rulesCache, null)
      await loadRules(true, v.apiUrl || DEFAULT_RULES_URL)
    }
  }, [notify, settings.apiUrl, loadRules])

  const addIgnore = useCallback(async (id: string) => {
    const rec = issues.find((i) => i.id === id)
    if (!rec) return
    const entry: IgnoredEntry = {
      id: rec.id,
      ruleId: rec.ruleId,
      nodeId: rec.target.nodeId,
      nodeName: rec.target.nodeName,
      title: rec.title,
      ignoredAt: new Date().toISOString(),
    }
    const next = [...ignored, entry]
    setIgnored(next)
    setIssues((arr) => arr.filter((i) => i.id !== id))
    await setPluginData(PLUGIN_DATA_KEYS.ignored, JSON.stringify(next))
  }, [ignored, issues])

  const restoreIgnore = useCallback(async (e: IgnoredEntry) => {
    const next = ignored.filter((x) => x.id !== e.id)
    setIgnored(next)
    await setPluginData(PLUGIN_DATA_KEYS.ignored, JSON.stringify(next))
  }, [ignored])

  const exportMd = useCallback(async () => {
    const md = renderMarkdownReport({
      score: computeScore(issues),
      docName,
      recommendations: issues,
    })
    const ok = await copyToClipboard(md)
    notify(ok ? t.actions.copy : 'Не удалось скопировать в буфер', !ok)
  }, [issues, docName, notify])

  const copyFix = useCallback(async (rec: Recommendation) => {
    const ok = await copyToClipboard(renderFixSnippet(rec))
    notify(ok ? t.actions.copy : 'Не удалось скопировать в буфер', !ok)
  }, [notify])

  const score = useMemo(() => computeScore(issues), [issues])
  const severityCounts = useMemo(() => {
    const c = { error: 0, warning: 0, info: 0 } as Record<Severity, number>
    for (const i of issues) c[i.severity] += 1
    return c
  }, [issues])
  void severityCounts

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: 'issues', label: t.tabs.issues },
    { id: 'learn', label: t.tabs.learn },
    { id: 'ignored', label: t.tabs.ignored },
    { id: 'settings', label: t.tabs.settings },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: colors.bg, color: colors.text }}>
      <header style={{
        padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8,
        borderBottom: `1px solid ${colors.border}`,
      }}>
        <strong style={{ fontSize: 13 }}>{t.app.title}</strong>
        <span style={{ fontSize: 11, color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          · {docName}
        </span>
      </header>

      <nav style={{ display: 'flex', borderBottom: `1px solid ${colors.border}` }}>
        {TABS.map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => setTab(tb.id)}
            style={{
              flex: 1,
              padding: '8px 4px',
              fontSize: 11,
              border: 'none',
              background: 'transparent',
              color: tab === tb.id ? colors.brand : colors.textSecondary,
              borderBottom: `2px solid ${tab === tb.id ? colors.brand : 'transparent'}`,
              cursor: 'pointer',
            }}
          >{tb.label}</button>
        ))}
      </nav>

      <main style={{ flex: 1, minHeight: 0 }}>
        {tab === 'issues' && (
          <IssuesScreen
            issues={issues}
            isRunning={isRunning}
            isAiRunning={isAiRunning}
            canRun={canRun}
            canRunAi={canRunAi}
            onRun={runAudit}
            onRunAi={runAi}
            onJump={(id) => postToSandbox({ type: 'jump-to-node', nodeId: id })}
            onIgnore={addIgnore}
            onSummaryExport={exportMd}
            onCopyFix={copyFix}
            score={score}
          />
        )}
        {tab === 'learn' && <LearnScreen rules={rules} selection={selection} />}
        {tab === 'ignored' && <IgnoredScreen entries={ignored} rules={rules} onRestore={restoreIgnore} />}
        {tab === 'settings' && (
          <SettingsScreen
            value={settings}
            rulesCount={rules.length}
            cachedAt={cachedAt}
            rulesSource={rulesSource}
            rulesVersion={rulesVersion}
            rulesUpdatedAt={rulesUpdatedAt}
            bundledAt={BUNDLED_AT}
            onSave={saveSettings}
            onReloadRules={() => loadRules(true, settings.apiUrl || DEFAULT_RULES_URL)}
            onClearCache={async () => {
              await setClientStorage(STORAGE_KEYS.rulesCache, null)
              applyPayload(BUNDLED_RULES, 'bundle')
              setCachedAt(null)
              notify('Кеш очищен — используется bundle')
            }}
          />
        )}
      </main>

      {toast ? (
        <div style={{
          position: 'absolute', left: 12, right: 12, bottom: 12,
          padding: '6px 10px', borderRadius: 6, fontSize: 11,
          background: colors.text, color: colors.bg, textAlign: 'center', opacity: 0.9,
        }}>{toast}</div>
      ) : null}
    </div>
  )
}
