# Рефакторинг renderer'а — план

Стосується лише `desktop/src`. Нода (`server/`) і `electron/` не чіпаються.

## Висновок аудиту в одному абзаці

Каркас уже правильний: FSD-шари, публічні `index.ts`, лінтер забороняє імпорти
вбік і вглиб, циклів між слайсами немає, `TODO`/`FIXME` у коді нуль. Тобто
переписувати архітектуру не треба. Борг лежить у трьох місцях: **(1)** один і
той самий код повторюється в 10–25 файлах фіч (підписка на мутації, текст
помилки сервера, `localStorage`, кнопка перевірки з'єднання); **(2)** частина
слайсів досі «пласка» — кілька компонентів, модель і утиліти лежать в одній
теці, всупереч §6 [architecture.md](architecture.md); **(3)** десяток файлів
переріс 300 рядків і тримає кілька тем одночасно (§12). План прибирає це
порядком «спершу спільні інструменти, потім структура, потім великі файли» —
кожен наступний етап коротшає завдяки попередньому.

## Правило структури слайса

Те, до чого приводиться кожен слайс (`pages`, `features`, `entities`):

```
<slice>/
├── index.ts              публічний API
├── <Main>.tsx            один головний компонент, що все компонує (якщо він є)
├── <Main>.module.scss
├── ui/                   решта компонентів — кожен у власній kebab-case теці
│   └── <part>/<Part>.tsx (+ .module.scss, вкладені частини — глибше)
├── model/                Effector: стор, події, ефекти, atom-моделі
├── api/                  запити (лише entities)
├── lib/                  чисті функції та хуки без розмітки
├── config/               константи, які читають двоє й більше
└── types/ або types.ts   типи, які читають двоє й більше
```

- У корені слайса не лежить нічого, крім `index.ts` і головного компонента.
  Якщо головного немає (слайс експортує кілька рівноправних віджетів) — усі
  вони в `ui/`.
- Модель завжди в `model/`, навіть одним файлом: тоді `model/` ↔ «тут стан»
  читається однаково в усіх слайсах.
- Константа чи тип, що належить одному компоненту, лишається в ньому (§6).
- Не ділимо там, де розбиття протягує десяток пропсів (§12, «Коли не ділити»).

## Що знайдено

### Дублювання

| Повтор | Скільки | Куди |
|---|---|---|
| `useEffect(() => { const stop = [m.finished.success.watch(…), …]; return () => stop.forEach(…) })` | 14 файлів | `shared/lib/useUnitWatch` |
| `error.body?.detail ?? t('…')` + тип `{ error: { body?: { detail?: string } \| null } }` | ~25 місць, тип — 6 копій | `shared/api/problemDetail` |
| `try { localStorage.getItem… } catch {}` пара read/write | 6 файлів | `shared/lib/storage` |
| Кнопка «Перевірити з'єднання» + статус ok/problem і їхні стилі | 3 drawer'и | `shared/ui/connection-check` |
| `fileName(file)` у `manage-unmatched-files` — копія з `entities/library-item` | 1 | імпорт із сутності |

### Пласкі слайси (кілька компонентів у корені)

`app/layout` (5 компонентів + wiring), `pages/auth` (5), `features/manage-lists`
(4 + модель + утиліта), `pages/read`, `features/search-media`,
`manage-unmatched-files`, `manage-torznab-sources`, `library-explorer`,
`download-torrent`, `download-chapters` (по 3), `pages/settings`, `pages/lists`,
`pages/fallback`, `scan-library`, `manage-torrent-client`, `manage-opds-servers`,
`auto-download-torrents` (по 2). Плюс 8 фіч тримають `model.ts` у корені.

`pages/media` і `pages/library` уже поділені на теки-частини, але без `ui/` —
приводяться до того ж вигляду, що `pages/home` після останнього рефакторингу.

### Файли, що переросли ~300 рядків

| Файл | Рядків | Що в ньому змішано |
|---|---|---|
| `entities/playback/ui/VideoPlayer.tsx` | 635 | клавіатура, автоприховування контролів, звітування прогресу, аудіодоріжки, анімація виходу, розмітка |
| `pages/media/library-section/LibrarySection.tsx` | 587 | 8 компонентів, 2 хуки, групування за сезонами |
| `features/search-torrents/TorrentSearchDrawer.tsx` | 403 | форма пошуку, фільтри, список результатів |
| `features/library-explorer/LibraryExplorer.tsx` | 399 | стан дерева, виділення, клавіатура, розмітка |
| `entities/reader/ui/book/BookReaderView.tsx` | 373 | рідер, панель змісту, налаштування вигляду |
| `pages/media/library-section/ChapterList.tsx` | 367 | фільтр джерел з `localStorage`, злиття завантажень, рядок розділу |
| `entities/library-item/model/model.ts` | 355 | запити/мутації, події сканування, модель, чисті хелпери файлу |
| `features/track-media/model/model.ts` | 345 | дві моделі + тост синхронізації |
| `features/download-torrent/TorrentDownloadList.tsx` | 337 | список + рядок + тони стану |
| `pages/library/scan-history/ScanHistoryPage.tsx` | 306 | пошук, групування, сторінка, група |
| `features/manage-unmatched-files/UnmatchedFilesDrawer.tsx` | 305 | drawer, сторінка групи, картка пропозиції |
| `features/auto-download-torrents/AutoDownloadPanel.tsx` | 303 | панель, деталі правила, підпис епізодів |

`shared/ui/select-dropdown` (352) і `shared/ui/rating-stars` (304) свідомо
лишаються цілими — §12.

### Стан перевірок до початку

- `arch:check` ✔, `test` ✔ (49 файлів, 267 тестів).
- `typecheck` ✘ — тільки `shared/ui/icon/sprite.gen.ts`: генератор пише
  `viewBox` рядком туди, де тип чекає число (з коміту `49550e5`).
- `format:check` ✘ — 16 файлів не відформатовані.

## Етапи

Кожен етап — окремий коміт (або кілька), після кожного зелені `arch:check`,
`typecheck`, `test`, `format:check`. Поведінка не змінюється ніде.

### Етап 0 — зелена базова лінія ✅

1. `prettier --write` для 16 файлів.
2. `sprite.gen.ts`: `@neodx/svg` пропускає висоту, коли вона дорівнює ширині,
   але `viewBox` пише — і виходить `[64, '0 0 24 24']`. Виправлено в самих SVG
   (`check`, `file-tree`, `list`, `node`, `reset`, `search`, `sparkles`):
   розміри збігаються з `viewBox`, зсунутий `viewBox` перенесено в
   `<g transform>`. `Icon` читає лише `viewBox`, тож вигляд не змінився.
3. `DatePicker`: явний тип параметра `onChange`.

### Етап 1 — спільні інструменти (DRY) ✅

1. `shared/lib/useUnitWatch(unit, handler)` — підписка на Effector-юніт на час
   життя компонента; завжди кличе свіжий handler, тож без списку залежностей.
   Замінив 19 `useEffect`-блоків із ручним `watch`/`unwatch`.
2. `shared/api/problemDetail(error, fallback)` і тип `RequestFailure` — замість
   ~25 `error.body?.detail ?? t(…)` і 6 інлайн-копій типу помилки.
3. `shared/lib/storage` — `readStored`/`writeStored`; 7 пар `try/catch` навколо
   `localStorage` зникли (мова, тема, плеєр, рідер, провайдер входу, фільтр
   розділів).
4. `shared/ui`: `ConnectionCheck` (3 drawer'и), `MoreMenu` (5 меню «⋮»),
   `ManagedList` (списки OPDS, Torznab, тек бібліотеки). Три однакові
   `.module.scss` видалено.
5. `manage-unmatched-files` бере `fileName` із `@entities/library-item`.

Свідомо лишено: тост `playback.failed` у `LibrarySection` і
`useContinueWatching` (3 рядки; сутності тостів не показують, нового винятку
заради цього не вводимо) і `Drawer.onOpenChange={next => !next && onClose()}`
(однорядковий, читається без обгортки).

### Етап 2 — структура фіч ✅

Кожна фіча — до правила вище: `model/`, `lib/`, `config/`, `ui/<part>/`.
Зроблено для `manage-opds-servers`, `manage-torrent-client`,
`manage-torznab-sources`, `auto-download-torrents`, `download-chapters`,
`download-torrent`, `library-explorer`, `manage-unmatched-files`,
`match-library-file`, `scan-library`, `manage-lists`, `search-media`,
`search-torrents`, `track-media`, `continue-watching`, `title-chapters`.

- Частина, яку використовує лише один компонент, лежить усередині його теки:
  `torrent-download-list/files-drawer`, `list-drawer/icon-picker`,
  `manage-entry-drawer/list-picker`, `torznab-sources/source-drawer`.
- Спільний `TorrentClient.module.scss` розділено між налаштуваннями й drawer'ом.
- `search-media`: `config.ts` → `config/config.ts`, `types.ts` →
  `model/types.ts` (це типи стану моделі).
- Фічі з одним компонентом (`choose-player`, `connect-anilist`,
  `link-manga-source`, `manage-library-roots`, `manage-mangadex`,
  `manage-source-keys`, `switch-*`) уже відповідали правилу.

### Етап 3 — структура сторінок і каркаса ✅

У слайсі `pages` «головний компонент» — це компонент маршруту: якщо слайс
обслуговує кілька маршрутів (`auth`, `lists`, `read`, `fallback`,
`library` + `ScanHistoryPage`), у корені лежать усі `*Page.tsx`, а все інше —
у `ui/`, `config/`, `lib/`, `model/`.

- `pages/media`: усі частини → `ui/`; `BookFiles` і `ChapterList` — усередині
  `ui/library-section/`, бо їх використовує лише `LibrarySection`.
- `pages/library`: `ScanHistoryPage` — маршрут, тож у корені; `FileLogItem` →
  `ui/file-log-item/` з `highlighted/` усередині.
- `pages/lists`, `pages/discover` → `ui/<part>/`.
- `pages/read`: `Panel` і його стилі (файл звався `ReadPage.module.scss`, хоча
  стилізував лише панель) → `ui/panel/Panel.*`.
- `auth/modes.ts` → `config/modes.ts`, `settings/sections.tsx` →
  `config/sections.tsx`.
- `app/layout`: `AppLayout` у корені; `sidebar/`, `player-host/`,
  `window-chrome/`, `window-drag-strip/`, `lib/list-wiring`.

### Етап 4 — великі файли ✅

Усі 12 файлів з таблиці розбито; понад 300 рядків лишились лише
`SelectDropdown` і `RatingStars`, які свідомо цілі (§12). Що варто знати:

- Нові спільні інструменти: `shared/lib/useAfterDelay` (таймер анімації
  виходу, який дослівно повторювали плеєр і рідер книг).
- Чиста логіка винесена в `lib/` і покрита тестами: релізи торентів, обхід
  дерева бібліотеки, хелпери файлу бібліотеки, патчі трекера, розділи манги,
  історія сканувань, підсумок автозавантаження, сезони епізодів.
- `track-media`: «чи є зміни» (`$dirty`) і «що відправити» тепер одна
  функція — форма брудна рівно тоді, коли патч непорожній.
- `library-item`: тригери оновлення колекції — той самий список, що й у дерева
  та файлів тайтла (був скопійований).
- Стилі розходились разом із розміткою. Де дочірній компонент раніше
  перебивав стиль варіанта `Button` завдяки вкладеності (`.toolbar .danger`),
  вкладеність збережено (`display: contents`-обгортка в `SelectionActions`),
  щоб вага селекторів не впала. Спільна анімація панелей плеєра — SCSS-міксин
  `_overlay-bar.scss`.

Типовий поділ:

- компонент → підкомпоненти в `ui/<part>/` + хуки поведінки в `lib/`
  (у `VideoPlayer`: `usePlayerKeyboard`, `useAutoHideControls`,
  `useProgressReporter`);
- модель → `model/` (стан) + `lib/` (чисті функції) + `config/` (константи);
  у `entities/library-item` хелпери файлу (`fileTitle`, `fileName`,
  `fileNumber`…) переходять у `lib/file.ts`, події сканування — у
  `model/scan.ts`.

### Етап 5 — сутності та shared ✅

- Компоненти `entities/media`, `tracker`, `library-item`, `torrent` — у
  власних теках `ui/<part>/`; `tracker/model/score-format` (чисті функції) →
  `lib/`. `playback` і `reader` розкладено ще на етапі 4.
- `FeaturedBanner`: ротація й попереднє завантаження картинок → хуки
  `ui/featured-banner/lib/` (ротація з тестом).
- `shared/lib` → `format/`, `hooks/`, `storage/`; `shared/ui`: частини
  `drawer`, `dropdown-menu`, `ripple`, `select-dropdown` — у підтеках.
- `entities/reader/lib` лишився пласким — це рівноправні чисті модулі з тестами.

### Етап 6 — закріпити ✅

1. Правило кореня слайса записане в §6 `architecture.md`, пункт — у §14.
2. `scripts/check-architecture.mjs` перевіряє корені слайсів `entities`,
   `features`, `pages`: зайвий файл у корені — помилка `arch:check`.

## Чого план свідомо не робить

- Не вводить нових слайсів і не рухає межі між ними (§12).
- Не тягне патерни заради патернів: єдині «патерни» тут — Observer
  (`useUnitWatch` поверх Effector `watch`) і Facade (`storage`,
  `problemDetail`) — обидва прибирають повтор, а не додають шар.
- Не чіпає `*.gen.ts` вручну, локалі (`en/uk/ru.ts` великі, бо це словник) і
  `shared/ui/icon/assets`.
