import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FigmaRule, FigmaRulesResponse } from '../shared/rules-types'
import type { SerializedNode } from '../shared/serialize'
import { postToSandbox, type SandboxToUi, type UiToSandbox } from '../shared/messages'
import type { Platform } from '../detectors/types'
import { runAutoAudit } from '../detectors'
import { buildRecommendation, type Recommendation } from '../shared/recommendation'
import { BUNDLED_AT, BUNDLED_RULES } from '../shared/rules-bundle'
import { DEFAULT_MODEL, type ClaudeModel, runVisionAudit } from '../vision/claude'
import {
  STORAGE_KEYS,
  getClientStorage,
  installStorageBridge,
  readJson,
  setClientStorage,
  writeJson,
} from '../storage/client'
import { SettingsScreen, type SettingsValue } from '../screens/SettingsScreen'
import { IssuesScreen } from '../screens/IssuesScreen'
import { computeScore, renderFixSnippet, renderMarkdownReport } from '../screens/summary'
import { t } from './i18n/ru'
import { copyToClipboard } from './clipboard'
import { LOGO_DATA_URI } from './logo'
import { ExternalLink } from './icons'

const DEFAULT_RULES_URL = 'https://design-libs.vercel.app/api/figma-rules/v1'

type Tab = 'audit' | 'ai' | 'settings'

const DEFAULT_SETTINGS: SettingsValue = {
  apiKey: '',
  model: DEFAULT_MODEL,
  platform: 'web',
  darkTheme: false,
  apiUrl: DEFAULT_RULES_URL,
}

interface CachedRules {
  fetchedAt: number
  payload: FigmaRulesResponse
}

type RulesSource = 'bundle' | 'cache' | 'api'

export function App() {
  const [tab, setTab] = useState<Tab>('audit')
  const [docName, setDocName] = useState('—')
  const [selection, setSelection] = useState<SerializedNode[]>([])
  const [rules, setRules] = useState<FigmaRule[]>(BUNDLED_RULES.rules)
  const [rulesVersion, setRulesVersion] = useState<string>(BUNDLED_RULES.version)
  const [rulesUpdatedAt, setRulesUpdatedAt] = useState<string>(BUNDLED_RULES.updatedAt)
  const [rulesSource, setRulesSource] = useState<RulesSource>('bundle')
  const [cachedAt, setCachedAt] = useState<string | null>(null)
  const [settings, setSettings] = useState<SettingsValue>(DEFAULT_SETTINGS)
  const [issues, setIssues] = useState<Recommendation[]>([])
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
  }, [applyPayload, refreshRules])

  const canRun = selection.length > 0 && rules.length > 0
  const canRunAi = canRun && settings.apiKey.trim().length > 0

  const runAudit = useCallback(() => {
    if (!canRun) return
    setIsRunning(true)
    try {
      const recs = runAutoAudit(
        {
          nodes: selection,
          settings: { platform: settings.platform as Platform, darkTheme: settings.darkTheme },
        },
        rules,
      )
      setIssues(recs)
    } finally {
      setIsRunning(false)
    }
  }, [canRun, selection, settings, rules])

  const runAi = useCallback(async () => {
    if (!canRunAi) {
      notify(t.errors.apiKeyMissing, true)
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
      const res = await runVisionAudit({
        apiKey: settings.apiKey,
        model: settings.model as ClaudeModel,
        pngBase64: png,
        rules: aiRules,
      })
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
        return [...withoutAi, ...aiRecs]
      })
      notify(`AI добавил: ${aiRecs.length}${res.usage ? ` · tokens ${res.usage.inputTokens}/${res.usage.outputTokens}` : ''}`)
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), true)
    } finally {
      setIsAiRunning(false)
    }
  }, [canRunAi, selection, settings, rules, notify])

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

  const exportMdFor = useCallback(async (subset: Recommendation[]) => {
    const md = renderMarkdownReport({
      score: computeScore(subset),
      docName,
      recommendations: subset,
    })
    const ok = await copyToClipboard(md)
    notify(ok ? t.actions.copy : 'Не удалось скопировать в буфер', !ok)
  }, [docName, notify])

  const copyFix = useCallback(async (rec: Recommendation) => {
    const ok = await copyToClipboard(renderFixSnippet(rec))
    notify(ok ? t.actions.copy : 'Не удалось скопировать в буфер', !ok)
  }, [notify])

  const autoIssues = useMemo(() => issues.filter((i) => i.origin !== 'ai'), [issues])
  const aiIssues = useMemo(() => issues.filter((i) => i.origin === 'ai'), [issues])
  const autoScore = useMemo(() => computeScore(autoIssues), [autoIssues])
  const aiScore = useMemo(() => computeScore(aiIssues), [aiIssues])
  const onJump = useCallback((id: string) => postToSandbox({ type: 'jump-to-node', nodeId: id }), [])

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: 'audit', label: t.tabs.audit },
    { id: 'ai', label: t.tabs.ai },
    { id: 'settings', label: t.tabs.settings },
  ]

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <header className="px-3 pt-3 pb-2 flex items-center gap-2">
        <img src={LOGO_DATA_URI} width={22} height={22} alt="" className="rounded-md flex-shrink-0" />
        <strong className="text-sm font-semibold tracking-tight">{t.app.title}</strong>
        <a
          href="https://design-libs.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="design-libs.vercel.app"
          aria-label="Открыть design-libs.vercel.app"
        >
          <ExternalLink size={13} />
        </a>
      </header>

      <nav className="flex border-b border-border bg-background px-1">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => setTab(tb.id)}
            className={
              'flex-1 py-2.5 px-2 text-[11px] font-medium transition-colors ' +
              (tab === tb.id
                ? 'text-foreground border-b-2 border-foreground -mb-px'
                : 'text-muted-foreground border-b-2 border-transparent hover:text-foreground')
            }
          >{tb.label}</button>
        ))}
      </nav>

      <main className="flex-1 min-h-0">
        {tab === 'audit' && (
          <IssuesScreen
            mode="auto"
            issues={autoIssues}
            rules={rules}
            isRunning={isRunning}
            canRun={canRun}
            onRun={runAudit}
            onJump={onJump}
            onSummaryExport={() => exportMdFor(autoIssues)}
            onCopyFix={copyFix}
            score={autoScore}
          />
        )}
        {tab === 'ai' && (
          <IssuesScreen
            mode="ai"
            issues={aiIssues}
            rules={rules}
            isRunning={isAiRunning}
            canRun={canRunAi}
            hasApiKey={settings.apiKey.trim().length > 0}
            onOpenSettings={() => setTab('settings')}
            onRun={runAi}
            onJump={onJump}
            onSummaryExport={() => exportMdFor(aiIssues)}
            onCopyFix={copyFix}
            score={aiScore}
          />
        )}
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
        <div className="absolute left-3 right-3 bottom-3 px-3 py-1.5 rounded-md text-[11px] bg-foreground text-background text-center opacity-90 shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  )
}
