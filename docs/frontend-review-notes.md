# Рев'ю renderer'а — нотатки

Робочий журнал проходів по `desktop/src` (див. етап 8+ у
[frontend-refactoring-plan.md](frontend-refactoring-plan.md)). Сюди потрапляє
те, що виглядає підозріло, але не виправлено одразу: рішення за власником, або
зміна поведінки, або межа між слайсами. Виправлене викреслюється й лишається
для історії.

Позначки: **[рішення]** — потрібен вибір власника; **[поведінка]** — схоже на
баг, виправлення змінить поведінку; **[борг]** — працює, але заважає
підтримці.

## Відкрите

- **[рішення]** `features/back-up-node` має власну `api/`, хоча за §6
  `api/` буває лише в `entities`. Чесне виправлення — нова сутність
  (`entities/sync` чи `backup`), тобто зміна меж, якої етапи не роблять.
- **[борг]** `features/auth` тримає `index.ts` у кожній теці компонента
  (`ui/common/auth-link/index.ts` …) — єдина фіча з такою схемою; решта
  імпортує файл напряму. Працює, але плутає при додаванні нового компонента.
- **[борг]** `features/auth/validation/` — окрема тека поза `lib/`, бо
  `limits.gen.ts` пише туди `scripts/gen-auth-limits.mjs`. Перенос — разом зі
  скриптом.

- **[поведінка]** `features/manual-media-form/lib/useCoverChoice.ts`,
  `findPoster`: після відповіді пошуку `automatic.current = true` ставиться
  завжди, навіть коли updater `setCover` залишив обкладинку, яку користувач
  вибрав сам, поки пошук ішов. Наступна підказка AI з «не впізнав» тоді
  викликає `dropAutoCover()` і скидає вибір користувача на `keep`.
  Виправлення: ставити прапорець лише коли обкладинку справді підставлено
  (рішення прийняти до `setCover`, за `cover`/`automatic` на момент відповіді).

- **[борг]** `features/manage-plugins/ui/install-dialog/InstallDialog.tsx`
  кличе `previewExtensionFx` / `installExtensionFx` / `updateExtensionFx`
  промісами прямо з компонента й тримає крок у `useState`. Решта форм ідуть
  через модель і `own-request` (§2 «Чия відповідь»). Наслідки:
  - **[поведінка]** `t` стоїть у залежностях початкового ефекту, тож зміна
    мови з відкритим діалогом читає маніфест ще раз і повертає на крок згоди;
  - повторне «Спробувати знову» поки триває попереднє читання — дві відповіді
    в гонці, перемагає та, що прийшла останньою (`read` не має `alive`).

- **[рішення]** `pages/media/ui/media-actions/MediaActions.tsx`: пункт меню
  «Додати в бібліотеку» завжди `disabled` з порожнім `onSelect` — заглушка
  нереалізованої дії. Або реалізувати, або прибрати, щоб не обіцяти
  користувачеві того, чого немає.

- ~~**[борг]** Тривалість анімації виходу `LEAVE_MS = 240` записана окремо в
  чотирьох компонентах, а анімація — у їхніх `.scss`~~ — анімація «аркуша»
  (плеєр, хост плеєра, два рідери, панель читання) тепер одна: міксин
  `shared/style/animation/_sheet-motion.scss` і хуки `useSheetEntrance` /
  `useSheetLeave` (`shared/lib`). Тривалості лишились у двох місцях —
  `$enter-duration`/`$leave-duration` і `SHEET_*_MS` поруч із хуками — бо SCSS
  і TS одне одного не читають.
- **[поведінка]** Номер епізоду файлу читається двома способами:
  `episodeNumber` (`continue-watching`: `match.episode ?? parsed.episode`) і
  `fileNumber` (`library-item`: `parsed.episode ?? parsed.chapter`, зіставлення
  ігнорує). Панель деталей провідника
  (`library-explorer/ui/detail-panel/DetailPanel.tsx`) показує поруч «Сезон»
  через `fileSeason` (спершу зіставлення) і «Епізод» через `fileNumber` (лише
  назва). Файл `s02e01.mkv`, вручну зіставлений як S3E5, там виглядає як
  «Сезон 3, Епізод 1», а на сторінці тайтлу — S3E5. Виправлення:
  `fileNumber` = `match.episode ?? parsed.episode ?? parsed.chapter`, як уже
  робить `fileSeason`. Друге місце, де живе `fileNumber`, — сортування
  незіставлених файлів — не зміниться: зіставлення там немає. Після цього
  `episodeNumber` і `fileNumber` різнитимуться лише розділом коміксу.

## Свідомо лишено

- `MediaTracking` (`entities/media`) і `EntryTracking` (`entities/tracker`) —
  однакові типи: сутності не імпортують одна одну (§4), це структурна копія.
- ~~Повтор «`useMissingToolAction` + тост `playback.playFailed`» у
  `useContinueWatching` і `EpisodeLibrary`~~ — `EpisodeLibrary` тепер бере
  `usePlayFile`, копії немає.
- Пара «Drawer + форма» в одному файлі (`AddTorrentDrawer`,
  `TorrentFilesDrawer`, `LinkSourceDrawer`, `PluginSettingsDrawer`,
  `MediaFormPage`): обгортка рендерить форму з `key`, щоб відкриття для
  іншого об'єкта скидало її стан. Форма — частина обгортки, а не окрема тема.
- Ще ~20 `.tsx` тримають поруч із компонентом дрібну приватну частину на
  5–20 рядків (`Field`, `Row`, `Card`…) або навмисний набір пов'язаних частин
  (`extensions/ui/catalog/Catalog.tsx`, `extensions/ui/actions/Actions.tsx`).
  Знайти: файли з кількома `function [A-Z]` у `entities|features|pages`.
- Стилі `PlayMenu` — один файл на всі підменю: `.episode .text` перебиває
  `.item .text` лише порядком у файлі.
