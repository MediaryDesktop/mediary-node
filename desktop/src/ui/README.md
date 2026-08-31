# ui

Дизайн-система: візуальні примітиви без знання домену.

```
Button · Input · Modal · Dialog · Tabs · Select · Tooltip · theme · tokens
```

Зараз тут лише `theme/global.scss` — reset і токени.

## Правило

`ui` не знає ні домену, ні інфраструктури.

Заборонено: `MediaCard`, `NodeStatusBadge`, `DownloadButton`, `ContinueWatching`.
Якщо компонент знає, що таке тайтл, завантаження або стан ноди — він належить
модулю-власнику або каркасу застосунку в `app/layout`.

Прикордонний випадок вирішується так: `Image` з lazy-загрузкою і плейсхолдером —
це `ui`; `Image`, що вміє будувати URL постера з `media_id` — це `modules/media`.

Може імпортувати: `@lib/*`.
