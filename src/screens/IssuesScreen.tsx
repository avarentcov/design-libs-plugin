import { useMemo, useState } from 'react'
import type { Recommendation } from '../shared/recommendation'
import type { FigmaRule, Severity } from '../shared/rules-types'
import { t } from '../ui/i18n/ru'
import { AlertCircle, AlertTriangle, ArrowRight, CheckCircle2, Copy, Download, ExternalLink, FilterX, Info, Key, MousePointer, Play, Sparkles, X } from '../ui/icons'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Select } from '../components/ui/select'
import { Progress } from '../components/ui/progress'
import { cn } from '../lib/utils'
import { scoreVerdict, type VerdictTone } from './summary'

export type AuditMode = 'auto' | 'ai'

export interface IssuesScreenProps {
  mode: AuditMode
  issues: Recommendation[]
  rules: FigmaRule[]
  isRunning: boolean
  canRun: boolean
  onRun: () => void
  onJump: (nodeId: string) => void
  onSummaryExport: () => void
  onCopyFix: (rec: Recommendation) => void
  onOpenSettings?: () => void
  hasApiKey?: boolean
  score: number
}

const SEVERITY_ORDER: Severity[] = ['error', 'warning', 'info']

const SEVERITY_COLOR: Record<Severity, string> = {
  error: 'text-destructive',
  warning: 'text-warning',
  info: 'text-primary',
}

function SeverityIcon({ s, size = 14 }: { s: Severity; size?: number }) {
  if (s === 'error') return <AlertCircle size={size} />
  if (s === 'warning') return <AlertTriangle size={size} />
  return <Info size={size} />
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</div>
      <div className="text-xs leading-relaxed">{children}</div>
    </div>
  )
}

function ExpandedCard({ rec, onJump, onCopyFix }: {
  rec: Recommendation
  onJump: (id: string) => void
  onCopyFix: (rec: Recommendation) => void
}) {
  return (
    <div className="flex flex-col gap-2.5 pt-2 mt-2 border-t border-dashed border-border">
      <Section label={t.section.what}>
        <div>{rec.summary}</div>
        {rec.measurements ? (
          <div className="mt-1 text-[11px] text-muted-foreground font-mono">
            {t.section.measurements}: {Object.entries(rec.measurements).map(([k, v]) => `${k}=${v}`).join(' · ')}
          </div>
        ) : null}
      </Section>

      <Section label={t.section.where}>
        <div>
          «{rec.target.nodeName}»
          {rec.target.hint ? <span className="text-muted-foreground"> — {rec.target.hint}</span> : null}
        </div>
        {rec.target.path ? (
          <div className="text-[11px] text-muted-foreground mt-0.5">{rec.target.path}</div>
        ) : null}
      </Section>

      <Section label={t.section.why}>
        <div className="text-[11px] text-muted-foreground mb-1">
          {rec.rationale.ruleName} · {rec.rationale.category}
          {rec.rationale.standard ? ` · ${rec.rationale.standard}` : ''}
        </div>
        <div>{rec.rationale.why}</div>
      </Section>

      <Section label={t.section.how}>
        {rec.fix.expected || rec.fix.actual ? (
          <div className="text-[11px] text-muted-foreground mb-1">
            {rec.fix.expected ? <>{t.section.expected}: <code className="px-1 py-0.5 bg-muted rounded">{rec.fix.expected}</code></> : null}
            {rec.fix.expected && rec.fix.actual ? ' · ' : null}
            {rec.fix.actual ? <>{t.section.actual}: <code className="px-1 py-0.5 bg-muted rounded">{rec.fix.actual}</code></> : null}
          </div>
        ) : null}
        <ol className="m-0 pl-5 flex flex-col gap-0.5 list-decimal">
          {rec.fix.steps.map((s, i) => (<li key={i}>{s}</li>))}
        </ol>
      </Section>

      {rec.examples && (rec.examples.good || rec.examples.bad) ? (
        <Section label={t.section.examples}>
          {rec.examples.good ? (
            <div><strong className="text-primary">✓ {t.section.good}:</strong> {rec.examples.good}</div>
          ) : null}
          {rec.examples.bad ? (
            <div><strong className="text-destructive">✗ {t.section.bad}:</strong> {rec.examples.bad}</div>
          ) : null}
        </Section>
      ) : null}

      <div className="flex gap-1.5 flex-wrap">
        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onJump(rec.target.nodeId) }} disabled={!rec.target.nodeId}>
          {t.section.jump} <ArrowRight size={12} />
        </Button>
        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onCopyFix(rec) }}>
          <Copy size={12} /> {t.section.copyFix}
        </Button>
        {rec.docUrl ? (
          <Button size="sm" variant="outline" asChild>
            <a href={rec.docUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
              {t.section.docs} <ExternalLink size={12} />
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Универсальная карточка пустого состояния в духе shadcn Empty pattern:
 * иконка в мягком круге → заголовок → описание → CTA.
 */
function EmptyState({
  icon,
  tone = 'muted',
  title,
  description,
  action,
}: {
  icon: React.ReactNode
  tone?: 'muted' | 'success' | 'primary' | 'warning'
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
}) {
  const toneClass: Record<'muted' | 'success' | 'primary' | 'warning', string> = {
    muted: 'bg-muted text-foreground',
    success: 'bg-success/10 text-success',
    primary: 'bg-primary/10 text-primary',
    warning: 'bg-warning/10 text-warning',
  }
  return (
    <div className="h-full flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-[320px] flex flex-col items-center gap-3 p-6 text-center">
        <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', toneClass[tone])}>
          {icon}
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-sm font-semibold leading-snug">{title}</div>
          {description ? (
            <div className="text-[11px] text-muted-foreground leading-relaxed">{description}</div>
          ) : null}
        </div>
        {action}
      </div>
    </div>
  )
}

export function IssuesScreen(props: IssuesScreenProps) {
  const [filter, setFilter] = useState<'all' | Severity>('all')
  const [ruleFilter, setRuleFilter] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const rulesById = useMemo(() => new Map(props.rules.map((r) => [r.id, r])), [props.rules])

  const visible = useMemo(() => {
    let arr = props.issues
    if (filter !== 'all') arr = arr.filter((i) => i.severity === filter)
    if (ruleFilter !== 'all') arr = arr.filter((i) => i.ruleId === ruleFilter)
    return arr
  }, [props.issues, filter, ruleFilter])

  const availableRuleIds = useMemo(() => {
    const seen = new Set<string>()
    for (const i of props.issues) seen.add(i.ruleId)
    return Array.from(seen)
  }, [props.issues])

  const grouped = useMemo(() => {
    const by: Record<Severity, Recommendation[]> = { error: [], warning: [], info: [] }
    for (const i of visible) by[i.severity].push(i)
    for (const s of SEVERITY_ORDER) by[s].sort((a, b) => b.priority - a.priority)
    return by
  }, [visible])

  const counts = useMemo(() => {
    const c = { error: 0, warning: 0, info: 0 }
    for (const i of props.issues) c[i.severity] += 1
    return c
  }, [props.issues])

  const isEmpty = visible.length === 0
  const showNoApiKey = props.mode === 'ai' && props.hasApiKey === false

  const PrimaryIcon = props.mode === 'ai' ? Sparkles : Play
  const primaryAction = props.mode === 'ai' ? t.actions.runAi : t.actions.runAudit

  const renderCard = (rec: Recommendation) => {
    const isOpen = expandedId === rec.id
    return (
      <div
        key={rec.id}
        onClick={() => setExpandedId(isOpen ? null : rec.id)}
        className={cn(
          'rounded-lg border p-3 mb-1.5 cursor-pointer transition-colors',
          isOpen ? 'bg-accent' : 'bg-card hover:bg-accent/50',
        )}
      >
        <div className="flex items-start gap-2">
          <div className={cn('pt-0.5', SEVERITY_COLOR[rec.severity])}>
            <SeverityIcon s={rec.severity} size={14} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="font-semibold text-xs flex-1 min-w-0 truncate">{rec.title}</span>
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0">P{rec.priority}</Badge>
            </div>
            <div className={cn('text-xs leading-snug mb-1', isOpen ? 'text-foreground' : 'text-muted-foreground')}>
              {rec.summary}
            </div>
            <div className="text-[11px] text-muted-foreground truncate">«{rec.target.nodeName}»</div>
          </div>
          <Button
            size="icon"
            variant="outline"
            title={t.audit.jump}
            disabled={!rec.target.nodeId}
            onClick={(e) => { e.stopPropagation(); props.onJump(rec.target.nodeId) }}
          >
            <ArrowRight size={13} />
          </Button>
        </div>
        {isOpen ? (
          <ExpandedCard rec={rec} onJump={props.onJump} onCopyFix={props.onCopyFix} />
        ) : null}
      </div>
    )
  }

  const total = props.issues.length
  const notStarted = total === 0 && !props.isRunning
  const verdict = scoreVerdict(props.score)
  const uniqueRules = availableRuleIds.length
  const shownCount = visible.length
  const filterActive = filter !== 'all' || ruleFilter !== 'all'
  const verdictBadgeVariant: Record<VerdictTone, 'destructive' | 'warning' | 'info' | 'success'> = {
    destructive: 'destructive',
    warning: 'warning',
    primary: 'info',
    success: 'success',
  }
  const indicatorColor: Record<VerdictTone, string> = {
    destructive: 'bg-destructive',
    warning: 'bg-warning',
    primary: 'bg-primary',
    success: 'bg-success',
  }
  const SEVERITY_TONE: Record<Severity, 'destructive' | 'warning' | 'primary'> = {
    error: 'destructive',
    warning: 'warning',
    info: 'primary',
  }
  const activeChipClass: Record<'destructive' | 'warning' | 'primary', string> = {
    destructive: 'bg-destructive text-destructive-foreground border-destructive',
    warning: 'bg-warning text-warning-foreground border-warning',
    primary: 'bg-primary text-primary-foreground border-primary',
  }

  const resetAllFilters = () => { setFilter('all'); setRuleFilter('all') }
  const showHeader = !notStarted && !showNoApiKey

  const resolveEmpty = (): React.ReactNode => {
    if (showNoApiKey) {
      return (
        <EmptyState
          icon={<Key size={20} />}
          tone="muted"
          title={props.mode === 'ai' ? t.audit.noApiKey : ''}
          description="Ключ нужен только для AI-режима. Хранится локально в Figma."
          action={props.onOpenSettings ? (
            <Button variant="default" onClick={props.onOpenSettings}>
              {t.audit.openSettings} <ArrowRight size={12} />
            </Button>
          ) : null}
        />
      )
    }
    if (notStarted && !props.canRun) {
      // выделения нет
      return (
        <EmptyState
          icon={<MousePointer size={20} />}
          tone="muted"
          title={t.audit.empty.noSelectionTitle}
          description={t.audit.empty.noSelectionDesc}
        />
      )
    }
    if (notStarted) {
      // выделение есть, но аудит ещё не запущен — CTA-кнопка уже в футере, не дублируем.
      const PrimaryIcon = props.mode === 'ai' ? Sparkles : Play
      const title = props.mode === 'ai' ? t.audit.empty.aiNotStartedTitle : t.audit.empty.notStartedTitle
      const desc = props.mode === 'ai' ? t.audit.empty.aiNotStartedDesc : t.audit.empty.notStartedDesc
      return (
        <EmptyState
          icon={<PrimaryIcon size={20} />}
          tone={props.mode === 'ai' ? 'primary' : 'muted'}
          title={title}
          description={desc}
        />
      )
    }
    if (isEmpty && filterActive) {
      return (
        <EmptyState
          icon={<FilterX size={20} />}
          tone="warning"
          title={t.audit.empty.filteredTitle}
          description={t.audit.empty.filteredDesc}
          action={
            <Button variant="outline" onClick={resetAllFilters}>
              <X size={12} /> {t.audit.empty.resetFilters}
            </Button>
          }
        />
      )
    }
    if (isEmpty) {
      return (
        <EmptyState
          icon={<CheckCircle2 size={20} />}
          tone="success"
          title={props.mode === 'ai' ? t.audit.empty.noIssuesAiTitle : t.audit.empty.noIssuesTitle}
          description={props.mode === 'ai' ? t.audit.empty.noIssuesAiDesc : t.audit.empty.noIssuesDesc}
        />
      )
    }
    return null
  }

  const empty = resolveEmpty()

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Шапка — только когда есть данные */}
      {showHeader ? (
        <div className="px-3 pt-3 pb-3 border-b border-border flex flex-col gap-3">
          <div className={cn('flex flex-col gap-2', props.isRunning && 'animate-pulse')}>
            <div className="flex items-center justify-between gap-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                {t.summary.score}
              </div>
              <Badge variant={verdictBadgeVariant[verdict.tone]}>
                {t.audit.verdicts[verdict.key]}
              </Badge>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold leading-none tabular-nums tracking-tight">{props.score}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{t.audit.scoreOutOf}</span>
              <span className="text-[11px] text-muted-foreground ml-auto tabular-nums">
                {t.audit.total(total)} · {t.audit.rulesCount(uniqueRules)}
              </span>
            </div>

            <Progress value={props.score} indicatorClassName={indicatorColor[verdict.tone]} />
          </div>

          <div className="flex gap-1 flex-wrap">
            {SEVERITY_ORDER.map((s) => {
              const active = filter === s
              const tone = SEVERITY_TONE[s]
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilter(active ? 'all' : s)}
                  className={cn(
                    'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-medium border transition-colors tabular-nums',
                    active
                      ? activeChipClass[tone]
                      : 'text-foreground border-border hover:bg-accent',
                  )}
                >
                  <span className={active ? '' : SEVERITY_COLOR[s]}>
                    <SeverityIcon s={s} size={11} />
                  </span>
                  <span className="tabular-nums">{counts[s]}</span>
                  <span className={cn('text-[10px]', active ? 'opacity-80' : 'text-muted-foreground')}>
                    {t.severity.label[s](counts[s])}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-1.5">
            <Select
              value={ruleFilter}
              onChange={(e) => setRuleFilter(e.target.value)}
              title="Фильтр по правилу"
              className="flex-1"
            >
              <option value="all">{t.audit.allRules}</option>
              {availableRuleIds.map((id) => {
                const rule = rulesById.get(id)
                return <option key={id} value={id}>{rule?.nameRu ?? id}</option>
              })}
            </Select>
            {ruleFilter !== 'all' ? (
              <Button
                size="icon"
                variant="outline"
                title={t.audit.resetFilter}
                onClick={() => setRuleFilter('all')}
              >
                <X size={12} />
              </Button>
            ) : null}
          </div>

          {filterActive ? (
            <div className="text-[11px] text-muted-foreground tabular-nums">
              {t.audit.filteredOf(shownCount, total)}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Список / эмпти-стейт */}
      <div className="flex-1 overflow-auto">
        {props.isRunning ? (
          <EmptyState
            icon={<span className="animate-pulse">{props.mode === 'ai' ? <Sparkles size={20} /> : <Play size={20} />}</span>}
            tone={props.mode === 'ai' ? 'primary' : 'muted'}
            title={props.mode === 'ai' ? t.audit.aiRunning : t.audit.running}
          />
        ) : empty ? (
          empty
        ) : (
          <div className="px-3 py-3">
            {SEVERITY_ORDER.filter((s) => grouped[s].length > 0).map((s) => (
              <div key={s} className="mb-3">
                <div className="flex items-center gap-1.5 mb-1.5 px-0.5">
                  <span className={SEVERITY_COLOR[s]}><SeverityIcon s={s} size={11} /></span>
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {t.severity[s]}
                  </span>
                  <span className="text-[11px] text-muted-foreground">· {grouped[s].length}</span>
                </div>
                {grouped[s].map(renderCard)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Футер */}
      <div className="px-3 py-3 border-t border-border flex gap-2">
        <Button
          variant="default"
          disabled={!props.canRun || props.isRunning}
          onClick={props.onRun}
          className="flex-1 h-9"
        >
          <PrimaryIcon size={13} /> {primaryAction}
        </Button>
        <Button
          variant="outline"
          onClick={props.onSummaryExport}
          disabled={props.issues.length === 0}
          title={t.actions.exportMd}
          className="h-9"
        >
          <Download size={13} /> {t.actions.report}
        </Button>
      </div>
    </div>
  )
}
