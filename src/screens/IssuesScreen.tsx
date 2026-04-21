import { useMemo, useState } from 'react'
import type { Recommendation } from '../shared/recommendation'
import type { Severity } from '../shared/rules-types'
import { colors, severityColor } from '../ui/theme'
import { t } from '../ui/i18n/ru'

export interface IssuesScreenProps {
  issues: Recommendation[]
  isRunning: boolean
  isAiRunning: boolean
  canRun: boolean
  canRunAi: boolean
  onRun: () => void
  onRunAi: () => void
  onJump: (nodeId: string) => void
  onIgnore: (id: string) => void
  onSummaryExport: () => void
  onCopyFix: (rec: Recommendation) => void
  score: number
}

const SEVERITY_ORDER: Severity[] = ['error', 'warning', 'info']

function SeverityPill({ s }: { s: Severity }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '1px 6px',
        borderRadius: 4,
        fontSize: 10,
        color: '#fff',
        background: severityColor[s],
        textTransform: 'uppercase',
        fontWeight: 700,
      }}
    >{s}</span>
  )
}

function PriorityChip({ p, severity }: { p: number; severity: Severity }) {
  return (
    <span
      title={`Приоритет ${p}/5`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontSize: 10,
        fontWeight: 700,
        color: severityColor[severity],
      }}
    >● P{p}</span>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, color: colors.textSecondary, fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.5 }}>{children}</div>
    </div>
  )
}

function smallBtn(extra?: React.CSSProperties): React.CSSProperties {
  return {
    fontSize: 11,
    padding: '3px 8px',
    borderRadius: 4,
    border: `1px solid ${colors.border}`,
    background: 'transparent',
    color: colors.text,
    cursor: 'pointer',
    ...extra,
  }
}

function ExpandedCard({ rec, onJump, onIgnore, onCopyFix }: {
  rec: Recommendation
  onJump: (id: string) => void
  onIgnore: (id: string) => void
  onCopyFix: (rec: Recommendation) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 6 }}>
      <Section label={t.section.what}>
        <div>{rec.summary}</div>
        {rec.measurements ? (
          <div style={{ marginTop: 4, fontSize: 11, color: colors.textSecondary, fontFamily: 'ui-monospace, monospace' }}>
            {t.section.measurements}: {Object.entries(rec.measurements).map(([k, v]) => `${k}=${v}`).join(' · ')}
          </div>
        ) : null}
      </Section>

      <Section label={t.section.where}>
        <div>
          «{rec.target.nodeName}»
          {rec.target.hint ? <span style={{ color: colors.textSecondary }}> — {rec.target.hint}</span> : null}
        </div>
        {rec.target.path ? (
          <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{rec.target.path}</div>
        ) : null}
      </Section>

      <Section label={t.section.why}>
        <div style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 3 }}>
          {rec.rationale.ruleName} · {rec.rationale.category}
          {rec.rationale.standard ? ` · ${rec.rationale.standard}` : ''}
        </div>
        <div>{rec.rationale.why}</div>
      </Section>

      <Section label={t.section.how}>
        {rec.fix.expected || rec.fix.actual ? (
          <div style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 3 }}>
            {rec.fix.expected ? <>{t.section.expected}: <code>{rec.fix.expected}</code></> : null}
            {rec.fix.expected && rec.fix.actual ? ' · ' : null}
            {rec.fix.actual ? <>{t.section.actual}: <code>{rec.fix.actual}</code></> : null}
          </div>
        ) : null}
        <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {rec.fix.steps.map((s, i) => (<li key={i}>{s}</li>))}
        </ol>
      </Section>

      {rec.examples && (rec.examples.good || rec.examples.bad) ? (
        <Section label={t.section.examples}>
          {rec.examples.good ? (
            <div><strong style={{ color: severityColor.info }}>✓ {t.section.good}:</strong> {rec.examples.good}</div>
          ) : null}
          {rec.examples.bad ? (
            <div><strong style={{ color: severityColor.error }}>✗ {t.section.bad}:</strong> {rec.examples.bad}</div>
          ) : null}
        </Section>
      ) : null}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onJump(rec.target.nodeId) }}
          disabled={!rec.target.nodeId}
          style={smallBtn({ opacity: rec.target.nodeId ? 1 : 0.4 })}
        >{t.section.jump} →</button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onCopyFix(rec) }}
          style={smallBtn()}
        >{t.section.copyFix}</button>
        {rec.docUrl ? (
          <a
            href={rec.docUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{ ...smallBtn(), textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
          >{t.section.docs} →</a>
        ) : null}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onIgnore(rec.id) }}
          style={smallBtn({ marginLeft: 'auto', color: colors.textSecondary })}
        >{t.actions.ignore}</button>
      </div>
    </div>
  )
}

export function IssuesScreen(props: IssuesScreenProps) {
  const [filter, setFilter] = useState<'all' | Severity>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const visible = useMemo(
    () => (filter === 'all' ? props.issues : props.issues.filter((i) => i.severity === filter)),
    [props.issues, filter],
  )

  const groups = useMemo(() => {
    const by: Record<Severity, Recommendation[]> = { error: [], warning: [], info: [] }
    for (const i of visible) by[i.severity].push(i)
    // внутри группы — по приоритету убыв.
    for (const s of SEVERITY_ORDER) by[s].sort((a, b) => b.priority - a.priority)
    return by
  }, [visible])

  const counts = useMemo(() => {
    const c = { error: 0, warning: 0, info: 0 }
    for (const i of props.issues) c[i.severity] += 1
    return c
  }, [props.issues])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '10px 12px', borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 11, color: colors.textSecondary }}>{t.summary.score}</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{props.score}</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {SEVERITY_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(filter === s ? 'all' : s)}
              style={{
                padding: '3px 6px',
                borderRadius: 4,
                fontSize: 11,
                border: `1px solid ${filter === s ? severityColor[s] : colors.border}`,
                background: filter === s ? severityColor[s] : 'transparent',
                color: filter === s ? '#fff' : colors.text,
                cursor: 'pointer',
              }}
            >{counts[s]}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        {props.isRunning || props.isAiRunning ? (
          <div style={{ padding: 24, textAlign: 'center', color: colors.textSecondary }}>
            {props.isAiRunning ? t.audit.aiRunning : t.audit.running}
          </div>
        ) : props.issues.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: colors.textSecondary }}>
            {props.canRun ? t.audit.noIssues : t.audit.needSelection}
          </div>
        ) : (
          SEVERITY_ORDER.filter((s) => groups[s].length > 0).map((s) => (
            <div key={s} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4, padding: '0 4px' }}>
                {t.severity[s]} · {groups[s].length}
              </div>
              {groups[s].map((rec) => {
                const isOpen = expandedId === rec.id
                return (
                  <div
                    key={rec.id}
                    onClick={() => setExpandedId(isOpen ? null : rec.id)}
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      border: `1px solid ${colors.border}`,
                      marginBottom: 6,
                      cursor: 'pointer',
                      background: isOpen ? colors.bgSecondary : 'transparent',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <SeverityPill s={rec.severity} />
                      <span style={{ fontWeight: 600, flex: 1 }}>{rec.title}</span>
                      <PriorityChip p={rec.priority} severity={rec.severity} />
                      <span style={{ fontSize: 10, color: colors.textSecondary }}>{rec.origin === 'ai' ? 'AI' : 'auto'}</span>
                    </div>
                    <div style={{ marginTop: 4, fontSize: 12, color: isOpen ? colors.text : colors.textSecondary }}>
                      {rec.summary}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 11, color: colors.textSecondary }}>
                      «{rec.target.nodeName}»
                    </div>
                    {isOpen ? (
                      <ExpandedCard
                        rec={rec}
                        onJump={props.onJump}
                        onIgnore={props.onIgnore}
                        onCopyFix={props.onCopyFix}
                      />
                    ) : null}
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>

      <div style={{ padding: 10, borderTop: `1px solid ${colors.border}`, display: 'flex', gap: 6 }}>
        <button
          type="button"
          disabled={!props.canRun || props.isRunning}
          onClick={props.onRun}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 6,
            border: 'none',
            background: colors.brand,
            color: colors.brandText,
            cursor: props.canRun ? 'pointer' : 'not-allowed',
            opacity: props.canRun ? 1 : 0.5,
          }}
        >{t.actions.runAudit}</button>
        <button
          type="button"
          disabled={!props.canRunAi || props.isAiRunning}
          onClick={props.onRunAi}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: `1px solid ${colors.border}`,
            background: 'transparent',
            color: colors.text,
            cursor: props.canRunAi ? 'pointer' : 'not-allowed',
            opacity: props.canRunAi ? 1 : 0.5,
          }}
        >{t.actions.runAi}</button>
        <button
          type="button"
          onClick={props.onSummaryExport}
          disabled={props.issues.length === 0}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: `1px solid ${colors.border}`,
            background: 'transparent',
            color: colors.text,
            cursor: props.issues.length ? 'pointer' : 'not-allowed',
            opacity: props.issues.length ? 1 : 0.5,
          }}
          title={t.actions.exportMd}
        >MD</button>
      </div>
    </div>
  )
}
