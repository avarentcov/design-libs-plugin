import { useMemo, useState } from 'react'
import type { FigmaRule } from '../shared/rules-types'
import type { SerializedNode } from '../shared/serialize'
import { colors } from '../ui/theme'
import { t } from '../ui/i18n/ru'

export interface LearnScreenProps {
  rules: FigmaRule[]
  selection: SerializedNode[]
}

function inferLayerKinds(nodes: SerializedNode[]): Set<string> {
  const kinds = new Set<string>()
  for (const n of nodes) {
    if (n.type === 'TEXT') kinds.add('text')
    if (/btn|button|cta/i.test(n.name)) kinds.add('button')
    if (/input|field|textarea|select/i.test(n.name)) kinds.add('form')
    if (/card/i.test(n.name)) kinds.add('card')
    if (/icon/i.test(n.name)) kinds.add('icon')
    if (n.fills.some((f) => f.type === 'IMAGE')) kinds.add('image')
  }
  return kinds
}

function relevantRules(rules: FigmaRule[], kinds: Set<string>): FigmaRule[] {
  if (kinds.size === 0) return rules
  const tokens: Record<string, RegExp> = {
    text: /typography|font|text|line|letter|contrast/i,
    button: /button|target|focus|disabled|cta|contrast/i,
    form: /label|input|validation|keyboard|error|form/i,
    card: /card|shadow|radius|space|hierarchy/i,
    icon: /icon|target|contrast/i,
    image: /image|contrast|text-on/i,
  }
  return rules.filter((r) => {
    const hay = `${r.id} ${r.category} ${r.tags.join(' ')}`
    for (const k of kinds) if (tokens[k]?.test(hay)) return true
    return false
  })
}

export function LearnScreen(props: LearnScreenProps) {
  const [showAll, setShowAll] = useState(false)
  const kinds = useMemo(() => inferLayerKinds(props.selection), [props.selection])
  const filtered = useMemo(
    () => (showAll ? props.rules : relevantRules(props.rules, kinds)),
    [props.rules, kinds, showAll],
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '10px 12px', borderBottom: `1px solid ${colors.border}`, display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => setShowAll(false)}
          style={{
            fontSize: 11,
            padding: '3px 8px',
            borderRadius: 4,
            border: `1px solid ${!showAll ? colors.brand : colors.border}`,
            background: !showAll ? colors.brand : 'transparent',
            color: !showAll ? colors.brandText : colors.text,
            cursor: 'pointer',
          }}
        >{t.learn.forSelected}</button>
        <button
          type="button"
          onClick={() => setShowAll(true)}
          style={{
            fontSize: 11,
            padding: '3px 8px',
            borderRadius: 4,
            border: `1px solid ${showAll ? colors.brand : colors.border}`,
            background: showAll ? colors.brand : 'transparent',
            color: showAll ? colors.brandText : colors.text,
            cursor: 'pointer',
          }}
        >{t.learn.allRules} · {props.rules.length}</button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        {!showAll && kinds.size === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: colors.textSecondary }}>{t.learn.empty}</div>
        ) : (
          filtered.map((r) => (
            <div
              key={r.id}
              style={{
                padding: 10,
                borderRadius: 8,
                border: `1px solid ${colors.border}`,
                marginBottom: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontWeight: 600, flex: 1 }}>{r.nameRu}</span>
                <span style={{ fontSize: 10, color: colors.textSecondary }}>{r.category}</span>
              </div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>{r.summary}</div>
              {r.antiPattern ? <div style={{ fontSize: 11, color: colors.textSecondary }}>✗ {r.antiPattern}</div> : null}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
