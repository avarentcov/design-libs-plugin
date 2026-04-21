import { useState } from 'react'
import type { ClaudeModel } from '../vision/claude'
import type { Platform } from '../detectors/types'
import { colors } from '../ui/theme'
import { t } from '../ui/i18n/ru'

export type AiMode = 'server' | 'byok'

export interface SettingsValue {
  apiKey: string
  model: ClaudeModel
  platform: Platform
  gridSize: number
  darkTheme: boolean
  apiUrl: string
  aiMode: AiMode
  aiServerUrl: string
}

export interface SettingsScreenProps {
  value: SettingsValue
  rulesCount: number
  cachedAt: string | null
  rulesSource: 'bundle' | 'cache' | 'api'
  rulesVersion: string
  rulesUpdatedAt: string
  bundledAt: string
  onSave: (v: SettingsValue) => void
  onReloadRules: () => void
  onClearCache: () => void
}

const SOURCE_LABEL: Record<'bundle' | 'cache' | 'api', string> = {
  bundle: 'встроен в плагин',
  cache: 'из кеша',
  api: 'свежий с API',
}

const MODELS: Array<{ id: ClaudeModel; label: string }> = [
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5 — быстро' },
  { id: 'claude-sonnet-4-5', label: 'Sonnet 4.5 — баланс (рекомендуется)' },
  { id: 'claude-opus-4-5', label: 'Opus 4.5 — глубоко' },
]

const PLATFORMS: Platform[] = ['web', 'ios', 'android']

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, color: colors.textSecondary }}>{label}</span>
      {children}
    </label>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '6px 8px',
  borderRadius: 6,
  border: `1px solid ${colors.border}`,
  background: colors.bg,
  color: colors.text,
  font: 'inherit',
}

export function SettingsScreen(props: SettingsScreenProps) {
  const [draft, setDraft] = useState<SettingsValue>(props.value)

  const aiModes: Array<{ id: AiMode; label: string; hint: string }> = [
    { id: 'server', label: 'Серверный (бесплатно)', hint: 'Через наш прокси Anthropic. Лимит 20 запросов в час с вашего IP.' },
    { id: 'byok', label: 'Свой ключ Anthropic', hint: 'Без лимитов. Ключ хранится только у вас.' },
  ]

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' }}>
      <Field label="AI-анализ">
        <div style={{ display: 'flex', gap: 4 }}>
          {aiModes.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setDraft({ ...draft, aiMode: m.id })}
              style={{
                flex: 1,
                padding: '6px 8px',
                borderRadius: 6,
                border: `1px solid ${colors.border}`,
                background: draft.aiMode === m.id ? colors.brand : 'transparent',
                color: draft.aiMode === m.id ? colors.brandText : colors.text,
                cursor: 'pointer',
                fontSize: 11,
              }}
            >{m.label}</button>
          ))}
        </div>
        <span style={{ fontSize: 10, color: colors.textSecondary }}>
          {aiModes.find((m) => m.id === draft.aiMode)?.hint}
        </span>
      </Field>

      {draft.aiMode === 'byok' ? (
        <Field label={t.settings.apiKey}>
          <input
            type="password"
            value={draft.apiKey}
            onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
            placeholder="sk-ant-…"
            style={inputStyle}
          />
          <span style={{ fontSize: 10, color: colors.textSecondary }}>{t.settings.apiKeyHint}</span>
        </Field>
      ) : null}

      <Field label="API каталога правил">
        <input
          type="text"
          value={draft.apiUrl}
          onChange={(e) => setDraft({ ...draft, apiUrl: e.target.value })}
          placeholder="https://design-libs.vercel.app/api/figma-rules/v1"
          style={inputStyle}
        />
        <span style={{ fontSize: 10, color: colors.textSecondary }}>
          По умолчанию — production. Для локальной разработки: http://localhost:3000/api/figma-rules/v1
        </span>
      </Field>

      {draft.aiMode === 'server' ? (
        <Field label="AI-сервер">
          <input
            type="text"
            value={draft.aiServerUrl}
            onChange={(e) => setDraft({ ...draft, aiServerUrl: e.target.value })}
            placeholder="https://design-libs.vercel.app/api/ai-audit/v1"
            style={inputStyle}
          />
        </Field>
      ) : null}

      <Field label={t.settings.model}>
        <select
          value={draft.model}
          onChange={(e) => setDraft({ ...draft, model: e.target.value as ClaudeModel })}
          style={inputStyle}
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </Field>

      <Field label={t.settings.platform}>
        <div style={{ display: 'flex', gap: 4 }}>
          {PLATFORMS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setDraft({ ...draft, platform: p })}
              style={{
                flex: 1,
                padding: '6px 8px',
                borderRadius: 6,
                border: `1px solid ${colors.border}`,
                background: draft.platform === p ? colors.brand : 'transparent',
                color: draft.platform === p ? colors.brandText : colors.text,
                cursor: 'pointer',
              }}
            >{p}</button>
          ))}
        </div>
      </Field>

      <Field label={t.settings.grid}>
        <div style={{ display: 'flex', gap: 4 }}>
          {[4, 8].map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setDraft({ ...draft, gridSize: g })}
              style={{
                flex: 1,
                padding: '6px 8px',
                borderRadius: 6,
                border: `1px solid ${colors.border}`,
                background: draft.gridSize === g ? colors.brand : 'transparent',
                color: draft.gridSize === g ? colors.brandText : colors.text,
                cursor: 'pointer',
              }}
            >{g}</button>
          ))}
        </div>
      </Field>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          checked={draft.darkTheme}
          onChange={(e) => setDraft({ ...draft, darkTheme: e.target.checked })}
        />
        <span>{t.settings.darkTheme}</span>
      </label>

      <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
        <div>{t.settings.rulesCached}: <strong>{props.rulesCount}</strong> · {SOURCE_LABEL[props.rulesSource]}</div>
        <div style={{ color: colors.textSecondary }}>
          Версия: {props.rulesVersion} · каталог от {new Date(props.rulesUpdatedAt).toLocaleDateString('ru-RU')}
        </div>
        <div style={{ color: colors.textSecondary }}>
          Bundle собран: {new Date(props.bundledAt).toLocaleString('ru-RU')}
        </div>
        {props.cachedAt ? <div style={{ color: colors.textSecondary }}>{t.settings.savedAt} {props.cachedAt}</div> : null}
        <div style={{ color: colors.textSecondary }}>{t.settings.priceNote}</div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
        <button
          type="button"
          onClick={() => props.onReloadRules()}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >{t.actions.reload}</button>
        <button
          type="button"
          onClick={() => props.onClearCache()}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >{t.actions.clearCache}</button>
        <button
          type="button"
          onClick={() => props.onSave(draft)}
          style={{
            marginLeft: 'auto',
            padding: '6px 14px',
            borderRadius: 6,
            border: 'none',
            background: colors.brand,
            color: colors.brandText,
            cursor: 'pointer',
          }}
        >{t.actions.save}</button>
      </div>
    </div>
  )
}
