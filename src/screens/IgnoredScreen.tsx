import type { FigmaRule } from '../shared/rules-types'
import { colors } from '../ui/theme'
import { t } from '../ui/i18n/ru'

export interface IgnoredEntry {
  id: string          // stable Recommendation.id
  ruleId: string
  nodeId: string
  nodeName?: string
  title?: string
  ignoredAt: string
}

export interface IgnoredScreenProps {
  entries: IgnoredEntry[]
  rules: FigmaRule[]
  onRestore: (e: IgnoredEntry) => void
}

export function IgnoredScreen(props: IgnoredScreenProps) {
  const rulesById = new Map(props.rules.map((r) => [r.id, r]))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '10px 12px', borderBottom: `1px solid ${colors.border}`, fontSize: 12 }}>
        {t.ignored.countLabel}: <strong>{props.entries.length}</strong>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        {props.entries.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: colors.textSecondary }}>{t.ignored.empty}</div>
        ) : (
          props.entries.map((e) => {
            const rule = rulesById.get(e.ruleId)
            return (
              <div
                key={e.id}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  border: `1px solid ${colors.border}`,
                  marginBottom: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>{e.title ?? rule?.nameRu ?? e.ruleId}</div>
                  <div style={{ fontSize: 11, color: colors.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    «{e.nodeName ?? e.nodeId}»
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => props.onRestore(e)}
                  style={{
                    fontSize: 11,
                    padding: '3px 8px',
                    borderRadius: 4,
                    border: `1px solid ${colors.border}`,
                    background: 'transparent',
                    color: colors.text,
                    cursor: 'pointer',
                  }}
                >{t.actions.restore}</button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
