# Design Lib Inspector

Figma-плагин для UX/UI-аудита макетов по **227 правилам лучших практик** (UX-законы + UI-гайдлайны из [design-libs](https://design-libs.vercel.app)). Гибрид детерминированных детекторов и Claude Vision с extended thinking.

> Пользовательская документация: [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md)

## Что умеет

- **29 детерминированных детекторов** (auto-аудит): WCAG-контраст, тач-зоны iOS/Android/Web, типографическая шкала, палитра, consistency radius/обводок/теней, focus/disabled, метки форм, закон Хика. Прогон локально за <5 мс.
- **AI-аудит через Claude Vision** — 97 правил с batched-запросами в Anthropic API. По умолчанию Opus 4.7 с extended thinking (8000 tokens budget), fallback на Haiku/Sonnet/Opus 4.5. Только BYOK.
- **Структурированные рекомендации** — `title / summary / target / rationale / fix.steps / examples` + priority P1–P5 + severity error/warning/info.
- **Умный jump-to-node** — точный переход детектора + фуззи-матч `nodeHint` у AI. Кросс-страничный через `setCurrentPageAsync`.
- **Группировка дублей** — одно правило на N слоях → одна карточка с бейджем `× N`, раскрывается в список с индивидуальными кнопками перехода.
- **Skip hidden layers** — `visible=false`, `opacity=0`, нулевой размер пропускаются вместе с поддеревом.
- **Score 0–100** по сглаженной формуле + вердикт (Критично → Отлично) с цветным индикатором.
- **Offline-first** — 227 правил встроены в бандл (493 КБ), работает без сети. Фоновой refresh с `design-libs.vercel.app/api/figma-rules/v1`.
- **MD-экспорт** отчёта в буфер обмена.
- **Локализация RU** с типографикой: «ёлочки», тире —, русская плюрализация.

## Архитектура

```
design-libs-plugin/
├─ manifest.json              # Figma Plugin API 1.0.0 (classic runtime)
├─ src/
│  ├─ sandbox/code.ts         # хост Figma API (es2017)
│  ├─ ui/
│  │  ├─ App.tsx              # React 18 + табы + state
│  │  ├─ icons.tsx            # lucide-style SVG
│  │  ├─ globals.css          # Tailwind + shadcn tokens
│  │  └─ i18n/ru.ts           # все строки UI
│  ├─ screens/
│  │  ├─ IssuesScreen.tsx     # общая вкладка Аудит/AI-аудит (mode prop)
│  │  ├─ SettingsScreen.tsx   # настройки (API-ключ, модель, платформа)
│  │  └─ summary.ts           # computeScore, scoreVerdict, Markdown
│  ├─ detectors/              # 29 детерминированных детекторов
│  ├─ vision/
│  │  ├─ claude.ts            # BYOK клиент + runVisionAuditBatched + thinking
│  │  └─ tool-schema.ts       # tool-use schema для structured output
│  ├─ components/ui/          # shadcn: Button/Badge/Card/Input/Select/Progress
│  ├─ shared/
│  │  ├─ rules-bundle.ts      # GENERATED snapshot 227 правил
│  │  ├─ rules-snapshot.json  # source для bundle
│  │  ├─ rules-types.ts       # GENERATED синк из v0-design-libs
│  │  ├─ ai-rule-overrides.ts # PROMOTE_TO_AI (77 manual→ai)
│  │  ├─ recommendation.ts    # модель данных + builder
│  │  └─ serialize.ts         # SceneNode → SerializedNode, skip hidden
│  ├─ storage/                # async-мост к figma.clientStorage
│  └─ lib/utils.ts            # cn() helper
├─ dist/                      # esbuild: code.js + ui.html (CSS inlined)
├─ scripts/
│  ├─ sync-types.mjs          # тянет типы из v0-design-libs
│  └─ embed-rules.mjs         # фетчит/эмбедит каталог
├─ docs/
│  └─ USER_GUIDE.md           # полный user guide
└─ community/                 # ассеты для Figma Community сабмита
```

## Установка

```bash
git clone https://github.com/avarentcov/design-libs-plugin.git
cd design-libs-plugin
npm install
npm run build
```

В Figma desktop: **Main menu → Plugins → Development → Import plugin from manifest…** → выбрать `manifest.json`.

### Watch-режим

```bash
npm run watch
```

В Figma: **Plugins → Development → Design Lib Inspector → Hot reload plugin** (⌥⌘P).

## Команды

| Скрипт | Что делает |
|---|---|
| `npm run build` | Tailwind → CSS → esbuild sandbox + UI → `dist/ui.html` инлайнит JS+CSS |
| `npm run watch` | Tailwind + esbuild в watch-режиме |
| `npm run sync-types` | Синкнуть типы с `v0-design-libs` |
| `npm run embed-rules` | Пересобрать snapshot каталога (localhost → prod → fallback) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest: 34 теста (детекторы / recommendation / bundle / vision / бенчмарк) |

## API правил

Плагин читает каталог с публичного эндпоинта:

```
GET https://design-libs.vercel.app/api/figma-rules/v1
→ { version, updatedAt, count: 227, rules: [...] }
```

ETag-кеш 1 час. Источник — [avarentcov/v0-design-libs](https://github.com/avarentcov/v0-design-libs).

## AI-аудит (BYOK)

В «Настройках» → **API-ключ Anthropic** → вставить `sk-ant-…`. Запросы идут напрямую в `api.anthropic.com` с заголовком `anthropic-dangerous-direct-browser-access: true`. Ключ хранится только в `figma.clientStorage` (привязан к user account, персистентен во всех файлах).

**Модели** в селекторе Настроек:
| Модель | Цена за прогон | Когда |
|---|---|---|
| Haiku 4.5 | ≈ $0.03 | быстрая проверка |
| Sonnet 4.5 | ≈ $0.10 | баланс |
| Opus 4.5 | ≈ $0.80 | глубоко |
| **Opus 4.7** | ≈ $1.20 | deep-thinking (по умолчанию) |

**Extended thinking** (8000 токенов budget) включается автоматически, graceful fallback если модель не поддерживает. **Batched runner** делит 97 правил на 3 батча по 35, запускает через `Promise.allSettled` — один упавший батч не валит весь прогон. Ответы через tool-use `report_issues` для гарантированного JSON.

## Детерминированные детекторы

| ID | Условия | Severity |
|---|---|---|
| `contrast-wcag` | <AA (4.5/3) | error |
| `contrast-nontext` | <3:1 | error/warning |
| `text-on-image` | текст над изображением | info |
| `touch-target` | <44/48/44 px (iOS/A/W) | error |
| `button-min-size` | <48×48 | warning |
| `target-spacing` | <32 px | warning/info |
| `font-size-min` | <12 px | error/warning |
| `line-height` | вне 1.35–1.75 (округление до 0.1) | warning |
| `line-length` | >100 CPL | warning/info |
| `letter-spacing` | вне −1…+3 % | warning/info |
| `font-sizes-scale` | >4 размеров | warning/error |
| `font-families` | >2 семейств | warning/error |
| `radius-consistency` | >2 вариантов, per-node targeting | warning/error |
| `stroke-consistency` | >2 толщин, per-node targeting | warning/error |
| `shadow-consistency` | >4 уровней, per-node targeting | warning/error |
| `palette-size` | >6 цветов | warning/error |
| `dark-theme-purity` | чистые #000/#FFF (dark-mode) | warning |
| `missing-label` | поле без label | **error** |
| `disabled-visible` | <4.5:1 контраст disabled-состояния | warning/error |
| `focus-visible` | нет focus-состояний | warning |
| `choice-count` | >7 пунктов (закон Хика) | info/warning/error |

Один детектор может быть привязан к нескольким rule'ам в каталоге — runtime дедупит и исполняет каждый ровно один раз.

## Поведение

- **Skip hidden**: `visible=false`, `opacity=0`, размер `0×0` → вся поддерево не сериализуется.
- **Дедуп**: `(ruleId, nodeId)` уникальность в UI + один запуск per detectorId.
- **Группировка**: одна карточка на ruleId, раскрывается в список всех затронутых слоёв.
- **Selection change** → сброс `issues` + флагов `autoRan/aiRan` (кроме self-инициированного jump-to-node).
- **API-ключ**: чистится от не-ASCII символов перед отправкой (решает криптическую ошибку «non ISO-8859-1 code point»).
- **Notify**: через `figma.notify` (нативный тост Figma), не дублируется в UI.

## Тесты

```bash
npm test
```

34 теста, p95 бенчмарка <5 мс на 51 ноде:
- 16 детекторов
- 8 recommendation builder
- 5 vision mock (tool-use парсинг, headers, ошибки, size-limit, валидация)
- 4 rules-bundle
- 1 бенчмарк производительности

## Связанные проекты

- **[v0-design-libs](https://github.com/avarentcov/v0-design-libs)** — Next.js сайт с каталогом правил. Хранит `ui-guide-data.ts` (UI-принципы) и `ux-laws-data.ts` (UX-законы). API `/api/figma-rules/v1` на [design-libs.vercel.app](https://design-libs.vercel.app).

## Лицензия

MIT
