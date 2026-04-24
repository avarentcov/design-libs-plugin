import { useEffect, useState } from 'react'
import type { ClaudeModel } from '../vision/claude'
import type { Platform } from '../detectors/types'
import { t } from '../ui/i18n/ru'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select } from '../components/ui/select'
import { cn } from '../lib/utils'
import { ExternalLink, RefreshCw, Trash2 } from '../ui/icons'
import { DEFAULT_THRESHOLDS, type Thresholds } from '../shared/thresholds'

export interface SettingsValue {
  apiKey: string
  model: ClaudeModel
  platform: Platform
  darkTheme: boolean
  apiUrl: string
  thresholds: Thresholds
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
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5 — быстро и дёшево' },
  { id: 'claude-sonnet-4-5', label: 'Sonnet 4.5 — баланс' },
  { id: 'claude-opus-4-5', label: 'Opus 4.5 — глубоко' },
  { id: 'claude-opus-4-7', label: 'Opus 4.7 — deep-thinking (рекомендуется)' },
]

const PLATFORMS: Platform[] = ['web', 'ios', 'android']

function maskKey(k: string): string {
  const trimmed = k.trim()
  if (trimmed.length < 12) return '••••'
  return `${trimmed.slice(0, 10)}•••${trimmed.slice(-4)}`
}

/** Маленькое числовое поле для порога. */
function NumInput({
  value, onChange, step = 1, min = 0, suffix, ariaLabel,
}: {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  suffix?: string
  ariaLabel?: string
}) {
  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        value={Number.isFinite(value) ? value : ''}
        min={min}
        step={step}
        onChange={(e) => {
          const n = parseFloat(e.target.value)
          onChange(Number.isFinite(n) ? n : 0)
        }}
        aria-label={ariaLabel}
        className="w-16 h-7 px-2 text-right tabular-nums"
      />
      {suffix ? <span className="text-[10px] text-muted-foreground">{suffix}</span> : null}
    </div>
  )
}

/** Секция настройки порогов для авто-детекторов. */
function ThresholdsSection({
  value, onChange,
}: { value: Thresholds; onChange: (t: Thresholds) => void }) {
  const [open, setOpen] = useState(false)
  const set = <K extends keyof Thresholds>(k: K, v: Thresholds[K]) => onChange({ ...value, [k]: v })
  const isDefault = JSON.stringify(value) === JSON.stringify(DEFAULT_THRESHOLDS)

  const Row = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-2 py-1">
      <div className="flex flex-col min-w-0">
        <span className="text-xs truncate">{label}</span>
        {hint ? <span className="text-[10px] text-muted-foreground truncate">{hint}</span> : null}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">{children}</div>
    </div>
  )

  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 p-3 text-left"
      >
        <span className="text-xs font-medium flex-1">Пороги авто-проверок</span>
        {!isDefault ? (
          <span className="text-[10px] text-warning">изменены</span>
        ) : null}
        <span className="text-[11px] text-muted-foreground">{open ? '▾' : '▸'}</span>
      </button>

      {open ? (
        <div className="px-3 pb-3 flex flex-col gap-1 border-t border-border">
          <div className="pt-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Контраст</div>
          <Row label="Обычный текст" hint="WCAG AA — 4.5, AAA — 7">
            <NumInput value={value.contrastNormal} step={0.1} min={1} onChange={(v) => set('contrastNormal', v)} suffix=":1" />
          </Row>
          <Row label="Крупный текст" hint="≥ 18px / ≥ 14px bold">
            <NumInput value={value.contrastLarge} step={0.1} min={1} onChange={(v) => set('contrastLarge', v)} suffix=":1" />
          </Row>
          <Row label="Иконки и границы" hint="non-text">
            <NumInput value={value.contrastNontext} step={0.1} min={1} onChange={(v) => set('contrastNontext', v)} suffix=":1" />
          </Row>

          <div className="pt-3 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Тач-зоны</div>
          <Row label="iOS" hint="HIG — 44">
            <NumInput value={value.touchIos} onChange={(v) => set('touchIos', v)} suffix="px" />
          </Row>
          <Row label="Android" hint="Material — 48">
            <NumInput value={value.touchAndroid} onChange={(v) => set('touchAndroid', v)} suffix="px" />
          </Row>
          <Row label="Web" hint="≥ 44">
            <NumInput value={value.touchWeb} onChange={(v) => set('touchWeb', v)} suffix="px" />
          </Row>
          <Row label="Кнопка минимум">
            <NumInput value={value.buttonMinSize} onChange={(v) => set('buttonMinSize', v)} suffix="px" />
          </Row>

          <div className="pt-3 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Консистентность</div>
          <Row label="Скругления" hint="макс. уникальных значений">
            <NumInput value={value.maxRadiusVariants} onChange={(v) => set('maxRadiusVariants', v)} />
          </Row>
          <Row label="Толщины обводок" hint="макс. уникальных">
            <NumInput value={value.maxStrokeVariants} onChange={(v) => set('maxStrokeVariants', v)} />
          </Row>
          <Row label="Уровни теней" hint="макс. уникальных drop-shadow">
            <NumInput value={value.maxShadowLevels} onChange={(v) => set('maxShadowLevels', v)} />
          </Row>
          <Row label="Цвета в палитре" hint="макс. уникальных">
            <NumInput value={value.maxPaletteColors} onChange={(v) => set('maxPaletteColors', v)} />
          </Row>

          <div className="pt-3 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Типографика</div>
          <Row label="Мин. размер шрифта">
            <NumInput value={value.fontSizeMin} onChange={(v) => set('fontSizeMin', v)} suffix="px" />
          </Row>
          <Row label="Макс. размеров шрифта">
            <NumInput value={value.maxFontSizes} onChange={(v) => set('maxFontSizes', v)} />
          </Row>
          <Row label="Макс. семейств">
            <NumInput value={value.maxFontFamilies} onChange={(v) => set('maxFontFamilies', v)} />
          </Row>
          <Row label="Line-height мин.">
            <NumInput value={value.lineHeightMin} step={0.05} min={1} onChange={(v) => set('lineHeightMin', v)} />
          </Row>
          <Row label="Line-height макс.">
            <NumInput value={value.lineHeightMax} step={0.05} min={1} onChange={(v) => set('lineHeightMax', v)} />
          </Row>
          <Row label="Макс. длина строки" hint="CPL">
            <NumInput value={value.lineLengthMax} onChange={(v) => set('lineLengthMax', v)} />
          </Row>

          <div className="pt-3 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Когнитивная нагрузка</div>
          <Row label="Макс. пунктов выбора" hint="Закон Хика (7±2)">
            <NumInput value={value.maxChoices} onChange={(v) => set('maxChoices', v)} />
          </Row>

          <div className="pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onChange(DEFAULT_THRESHOLDS)}
              disabled={isDefault}
            >
              <Trash2 size={12} /> Сбросить к дефолтам
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

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

  // Синхронизируем draft с сохранёнными настройками: clientStorage загружается
  // асинхронно, и если пользователь успел открыть вкладку «Настройки» до
  // завершения загрузки, поле ключа было бы пустым.
  useEffect(() => {
    setDraft(props.value)
  }, [props.value])

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
        {draft.apiKey ? (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-success" />
            Сохранён: {maskKey(draft.apiKey)} · {draft.apiKey.length} симв.
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
            Не задан
          </div>
        )}
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

      <ThresholdsSection
        value={draft.thresholds}
        onChange={(thresholds) => setDraft({ ...draft, thresholds })}
      />

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
