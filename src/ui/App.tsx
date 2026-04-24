import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FigmaRule, FigmaRulesResponse } from '../shared/rules-types'
import type { SerializedNode } from '../shared/serialize'
import { postToSandbox, type SandboxToUi, type UiToSandbox } from '../shared/messages'
import type { Platform } from '../detectors/types'
import { runAutoAudit } from '../detectors'
import { buildRecommendation, type Recommendation } from '../shared/recommendation'
import { BUNDLED_AT, BUNDLED_RULES } from '../shared/rules-bundle'
import { applyAiOverrides } from '../shared/ai-rule-overrides'
import { DEFAULT_THRESHOLDS, applyThresholds } from '../shared/thresholds'
import { DEFAULT_MODEL, type ClaudeModel, runVisionAuditBatched } from '../vision/claude'
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
  thresholds: DEFAULT_THRESHOLDS,
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
  const [rules, setRules] = useState<FigmaRule[]>(() => applyAiOverrides(BUNDLED_RULES.rules))
  const [rulesVersion, setRulesVersion] = useState<string>(BUNDLED_RULES.version)
  const [rulesUpdatedAt, setRulesUpdatedAt] = useState<string>(BUNDLED_RULES.updatedAt)
  const [rulesSource, setRulesSource] = useState<RulesSource>('bundle')
  const [cachedAt, setCachedAt] = useState<string | null>(null)
  const [settings, setSettings] = useState<SettingsValue>(DEFAULT_SETTINGS)
  const [issues, setIssues] = useState<Recommendation[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [isAiRunning, setIsAiRunning] = useState(false)
  const [autoRan, setAutoRan] = useState(false)
  const [aiRan, setAiRan] = useState(false)
  /** Флаг «сейчас прыгнем к ноде сами» — чтобы не сбросить результаты аудита по ответному selectionchange. */
  const jumpingRef = useRef(false)

  const notify = useCallback((message: string, error = false) => {
    // Нотификации показываются системным тостом Figma (figma.notify через
    // sandbox) — появляется снаружи панели плагина, не перекрывает её кнопки.
    postToSandbox({ type: 'notify', message, error })
  }, [])

  const applyPayload = useCallback((payload: FigmaRulesResponse, source: RulesSource, fetchedAt?: number) => {
    setRules(applyAiOverrides(payload.rules))
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
          // Смена выделения из-за нашего собственного jump-to-node — не инвалидируем
          // результаты, пользователь просто переходит к проблемному слою.
          if (jumpingRef.current) {
            jumpingRef.current = false
          } else {
            // Прошлые результаты теряют актуальность при смене выделения.
            setIssues([])
            setAutoRan(false)
            setAiRan(false)
          }
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
      const effective: SettingsValue = {
        ...DEFAULT_SETTINGS,
        ...savedSettings,
        apiKey: savedKey,
        // Мердж порогов: если пользователь сохранил старые настройки без `thresholds`,
        // или без какого-то поля — докладываем дефолты.
        thresholds: { ...DEFAULT_THRESHOLDS, ...(savedSettings?.thresholds ?? {}) },
      }
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
      // Применяем пользовательские пороги к правилам перед прогоном.
      const tuned = applyThresholds(rules, settings.thresholds)
      const recs = runAutoAudit(
        {
          nodes: selection,
          settings: { platform: settings.platform as Platform, darkTheme: settings.darkTheme },
        },
        tuned,
      )
      setIssues((prev) => [...prev.filter((p) => p.origin === 'ai'), ...recs])
      setAutoRan(true)
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
      const aiRules = rules.filter((r) => r.checkType === 'ai')
      const model = (settings.model as ClaudeModel) || DEFAULT_MODEL
      const modelLabel = model.replace('claude-', '').replace(/-/g, ' ')
      // Каталог слоёв для модели: тот же selection[], что и у автоаудита, только
      // компактно (id/name/type/text). Корневой фрейм исключаем — просили
      // модель не ссылаться на него.
      const nodesCatalog = selection
        .filter((n) => n.id !== firstId && n.name)
        .map((n) => {
          const entry: { id: string; name: string; type: string; text?: string } = {
            id: n.id,
            name: n.name,
            type: n.type,
          }
          const chars = n.text?.characters?.trim()
          if (chars) entry.text = chars.length > 80 ? `${chars.slice(0, 80)}…` : chars
          return entry
        })
      const res = await runVisionAuditBatched({
        apiKey: settings.apiKey,
        model,
        pngBase64: png,
        rules: aiRules,
        nodes: nodesCatalog,
        rootNodeId: firstId,
        onProgress: (done, total) => {
          if (total > 1) notify(`${modelLabel} · батч ${done}/${total}`)
        },
      })
      const rulesById = new Map(rules.map((r) => [r.id, r]))
      const firstNode = selection[0]

      // Фуззи-поиск ноды по подсказке Claude. nodeHint может быть именем слоя,
      // текстом с подсказки («Label», «кнопка Оплатить», «карточка ЮMoney»).
      // Ищем наилучшее совпадение по имени ноды ИЛИ по содержимому text-ноды.
      const normalize = (s: string): string =>
        s.toLowerCase()
          .replace(/[«»"“”„`'‘’]+/g, ' ')
          .replace(/[.,:;!?()\[\]{}<>/\\|_#-]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()

      const rootId = firstNode?.id
      const findNodeByHint = (hint: string | undefined) => {
        if (!hint) return null
        const normHint = normalize(hint)
        if (!normHint) return null
        const hintTokens = normHint.split(' ').filter((t) => t.length >= 2)
        if (hintTokens.length === 0) return null

        let best: { node: typeof selection[number]; score: number } | null = null
        for (const n of selection) {
          if (!n.name || n.id === rootId) continue // не возвращаем корневой фрейм
          const normName = normalize(n.name)
          const normText = n.text?.characters ? normalize(n.text.characters) : ''
          let score = 0

          // 1. Полное совпадение имени
          if (normName && normName === normHint) score = Math.max(score, 1000)
          // 2. Совпадение текста ноды
          if (normText && normText === normHint) score = Math.max(score, 900)
          // 3. Имя целиком в hint или hint в имени
          if (normName && normHint.includes(normName) && normName.length >= 3) {
            score = Math.max(score, 500 + normName.length)
          }
          if (normName && normName.includes(normHint) && normHint.length >= 3) {
            score = Math.max(score, 400 + normHint.length)
          }
          // 4. Токен-матч: сколько слов hint'а встретились в имени/тексте
          if (hintTokens.length > 0) {
            const haystack = `${normName} ${normText}`
            let matched = 0
            let matchedLen = 0
            for (const tok of hintTokens) {
              if (haystack.includes(tok)) { matched += 1; matchedLen += tok.length }
            }
            if (matched > 0) {
              // чем больше слов совпало и чем длиннее они — тем лучше
              score = Math.max(score, matched * 50 + matchedLen + (matched === hintTokens.length ? 100 : 0))
            }
          }
          // 5. Бонус text-нодам (чаще AI указывает на конкретный текст)
          if (score > 0 && n.type === 'TEXT') score += 20

          if (score > (best?.score ?? 0)) best = { node: n, score }
        }
        return (best && best.score >= 30) ? best.node : null
      }

      const nodesById = new Map(selection.map((n) => [n.id, n]))
      const aiRecs: Recommendation[] = []
      for (const ai of res.issues) {
        const rule = rulesById.get(ai.ruleId)
        if (!rule) continue
        // Приоритет: явный nodeId от модели (если он есть в selection и не
        // корневой) → фаззи-поиск по nodeHint → без таргета. Фолбэк на
        // firstNode убран — он давал скролл на весь фрейм и «очень большую
        // область выделения».
        let target: SerializedNode | null | undefined = null
        if (ai.nodeId && ai.nodeId !== firstId) {
          target = nodesById.get(ai.nodeId) ?? null
        }
        if (!target) target = findNodeByHint(ai.nodeHint)
        aiRecs.push(
          buildRecommendation({
            rule,
            origin: 'ai',
            severity: ai.severity,
            target: {
              // Пустая строка = нет таргета → кнопка «перейти» в UI будет
              // disabled. Лучше, чем скроллить к корневому фрейму.
              nodeId: target?.id ?? '',
              nodeName: target?.name ?? 'layer',
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
      setAiRan(true)
      if (aiRecs.length === 0) {
        notify('AI не нашёл проблем. Попробуйте другую модель (Sonnet/Opus) или выделите более сложный фрейм.')
      } else {
        notify(`AI добавил: ${aiRecs.length}${res.usage ? ` · ${res.usage.inputTokens}/${res.usage.outputTokens} tok` : ''}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/invalid x-api-key|authentication/i.test(msg)) {
        notify('API-ключ не принят Anthropic. Откройте «Настройки» и проверьте ключ.', true)
        setTab('settings')
      } else {
        notify(msg, true)
      }
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
  const onJump = useCallback((id: string) => {
    jumpingRef.current = true
    postToSandbox({ type: 'jump-to-node', nodeId: id })
  }, [])

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
          className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-[hsl(217,91%,60%)] hover:underline"
          title="Открыть design-libs.vercel.app"
        >
          design-libs.vercel.app
          <ExternalLink size={10} />
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
            hasRun={autoRan}
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
            hasRun={aiRan}
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

    </div>
  )
}
