import { useState } from 'react'
import type { ClaudeModel } from '../vision/claude'
import type { Platform } from '../detectors/types'
import { t } from '../ui/i18n/ru'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select } from '../components/ui/select'
import { cn } from '../lib/utils'
import { ExternalLink, RefreshCw, Trash2 } from '../ui/icons'

export interface SettingsValue {
  apiKey: string
  model: ClaudeModel
  platform: Platform
  darkTheme: boolean
  apiUrl: string
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

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
      {hint ? <span className="text-[10px] text-muted-foreground leading-relaxed">{hint}</span> : null}
    </label>
  )
}

export function SettingsScreen(props: SettingsScreenProps) {
  const [draft, setDraft] = useState<SettingsValue>(props.value)

  return (
    <div className="p-3 flex flex-col gap-3 overflow-auto">
      <Field
        label={t.settings.apiKey}
        hint={
          <>
            {t.settings.apiKeyHint}{' '}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-primary underline underline-offset-2 hover:no-underline"
            >
              Получить ключ <ExternalLink size={10} />
            </a>
          </>
        }
      >
        <Input
          type="password"
          value={draft.apiKey}
          onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
          placeholder="sk-ant-…"
        />
      </Field>

      <Field
        label="API каталога правил"
        hint={<>По умолчанию — production. Для локальной разработки: http://localhost:3000/api/figma-rules/v1</>}
      >
        <Input
          value={draft.apiUrl}
          onChange={(e) => setDraft({ ...draft, apiUrl: e.target.value })}
          placeholder="https://design-libs.vercel.app/api/figma-rules/v1"
        />
      </Field>

      <Field label={t.settings.model}>
        <Select
          value={draft.model}
          onChange={(e) => setDraft({ ...draft, model: e.target.value as ClaudeModel })}
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </Select>
      </Field>

      <Field label={t.settings.platform}>
        <div className="flex gap-1">
          {PLATFORMS.map((p) => {
            const active = draft.platform === p
            return (
              <button
                key={p}
                type="button"
                onClick={() => setDraft({ ...draft, platform: p })}
                className={cn(
                  'flex-1 h-8 rounded-md border text-xs font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border hover:bg-accent text-foreground',
                )}
              >{p}</button>
            )
          })}
        </div>
      </Field>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={draft.darkTheme}
          onChange={(e) => setDraft({ ...draft, darkTheme: e.target.checked })}
          className="rounded border-input"
        />
        <span className="text-xs">{t.settings.darkTheme}</span>
      </label>

      <div className="rounded-lg border border-border bg-card p-3 flex flex-col gap-1 text-[11px]">
        <div>{t.settings.rulesCached}: <strong>{props.rulesCount}</strong> · {SOURCE_LABEL[props.rulesSource]}</div>
        <div className="text-muted-foreground">
          Версия: {props.rulesVersion} · каталог от {new Date(props.rulesUpdatedAt).toLocaleDateString('ru-RU')}
        </div>
        <div className="text-muted-foreground">
          Bundle собран: {new Date(props.bundledAt).toLocaleString('ru-RU')}
        </div>
        {props.cachedAt ? <div className="text-muted-foreground">{t.settings.savedAt} {props.cachedAt}</div> : null}
        <div className="text-muted-foreground mt-1">{t.settings.priceNote}</div>
      </div>

      <div className="flex gap-1.5 mt-auto pt-2">
        <Button variant="outline" onClick={() => props.onReloadRules()}>
          <RefreshCw size={12} /> {t.actions.reload}
        </Button>
        <Button variant="outline" onClick={() => props.onClearCache()}>
          <Trash2 size={12} /> {t.actions.clearCache}
        </Button>
        <Button variant="default" onClick={() => props.onSave(draft)} className="ml-auto">
          {t.actions.save}
        </Button>
      </div>
    </div>
  )
}
