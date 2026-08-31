# mediary-node

Self-hosted нода Mediary + десктоп-клієнт. **Відкритий репозиторій** — і це
свідомо: застосунок керує торрентами й особистими файлами на компʼютері
користувача, тож код має бути видимим ([TZ §3.1](../TZ.md), за прикладом
Seanime).

```
mediary-node/
  server/     Go — торренти, скан бібліотеки, mpv, рідер, синк із хмарою
  desktop/    Electron + React — UI хмарного каталогу і керування нодою
```

## Швидкий старт

```bash
npm ci
npm run server:build        # збирає server/bin/nodesrv — десктоп його запускає
npm run dev                 # Electron із гарячим перезавантаженням
```

Потрібні: Node 22+, Go 1.27, [Task](https://taskfile.dev).

> **VS Code:** інтегрований термінал експортує `ELECTRON_RUN_AS_NODE=1`, через що
> Electron стартує як звичайний Node і падає з `Cannot read properties of
> undefined (reading 'app')`. Запускай `npm run dev` у зовнішньому терміналі або
> прибери змінну.

> Якщо `npm ci` завершився, а `electron-vite` каже `Error: Electron uninstall` —
> постінстал не докачав бінарник Electron. Лікується `npm rebuild electron`.

## Дві половини, два процеси

Нода — **окремий процес**, а не бібліотека всередині Electron. Renderer говорить
із нею по HTTP/WS на `127.0.0.1`, а не через IPC.

```
Electron main ──spawn──▶ nodesrv (Go)
      │                      ▲
      │ IPC: {url, token}    │ HTTP + WS на 127.0.0.1
      ▼                      │
   preload ──▶ renderer ─────┘
```

Це коштує один сокет і дає дві речі:

- **headless-режим безкоштовно** — та сама нода працює в Docker на домашньому
  сервері, без жодного рядка з `desktop/`;
- **краш торрент-рушія кладе процес, який оболонка перезапустить**, а не вікно,
  в яке дивиться користувач. Супервізор у
  [electron/main/node-supervisor.ts](desktop/electron/main/node-supervisor.ts)
  перезапускає ноду з backoff і повідомляє UI про стан.

**Локальний токен обовʼязковий.** «Слухає лише loopback» — це не контроль
доступу: до `127.0.0.1` дістанеться будь-який процес на машині й будь-яка
сторінка у браузері користувача. Токен генерується оболонкою на кожен запуск і
передається ноді через середовище; без нього нода віддає 401 навіть на
loopback ([TZ §8](../TZ.md)).

## Команди

| Команда | Що робить |
|---|---|
| `npm run dev` | Electron + renderer із HMR |
| `npm run build` | typecheck + продакшн-збірка трьох бандлів |
| `npm run dist` | інсталятор через electron-builder |
| `npm run check` | формат, arch:check, typecheck, тести |
| `npm run api:types` | TS-типи з обох OpenAPI-специфікацій |
| `npm run server:dev` \| `server:build` \| `server:check` | проксі в `server/Taskfile.yml` |

Go-частина має власні команди — див. [server/Taskfile.yml](server/Taskfile.yml)
і `task --list`.

## Архітектура

- Сервер ноди: [docs/server-architecture.md](docs/server-architecture.md)
- Renderer: [docs/architecture.md](docs/architecture.md) — модульний моноліт,
  ownership і межі, як їх перевіряє `npm run arch:check`
- Плани реалізації: [../docs/plans/](../docs/plans/)

## Залежність від контракту

`server/internal/platform/cloud` імпортує згенерований клієнт із
`mediary-contracts`. Поки цей модуль не опублікований, він резолвиться через
`go.work` у корені воркспейсу — навмисно **не** через `replace` у `go.mod`, який
зламав би збірку всім, у кого немає цієї розкладки тек. Подробиці — у
[mediary-contracts/docs/contracts-and-codegen.md](../mediary-contracts/docs/contracts-and-codegen.md) §6.

## Стан

Фаза 0: скелет без бізнес-логіки. Кожен модуль ноди віддає один
`GET /v1/<module>/status`; десктоп показує одну сторінку, яка доводить, що вся
вертикаль зібрана — оболонка → нода → токен → згенеровані типи → Effector → React.
