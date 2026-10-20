# Writing a plugin

A Mediary plugin adds a place to search for torrents. It is two files: a
`manifest.json` that says what the plugin is and which sites it reaches, and a
`plugin.js` that does the searching. [`plugin.d.ts`](plugin.d.ts) has the
types; the node's tests run a
[complete example](../../server/internal/modules/extension/internal/manifest/testdata/example).

## What the node does and what the plugin does

The plugin is asked for a search and returns releases: titles, with a magnet
link, a `.torrent` link or an info hash, and whatever size, seeders and date the
site shows. Everything after that is the node's: reading resolution and release
group from the title, telling an episode from a batch, ranking by the user's
profile, marking what a debrid service holds, downloading, streaming, and
grabbing new episodes by the user's rules. A plugin does not need to do any of
it.

## The manifest

```json
{
  "id": "example-tracker",
  "name": "Example tracker",
  "version": "1.0.0",
  "type": "torrent-provider",
  "author": "you",
  "description": "What it searches",
  "lang": "en",
  "network": ["tracker.example.org"],
  "config": [{ "name": "apiKey", "label": "API key", "type": "text", "secret": true }],
  "payload": "https://example.org/example-tracker/1.0.0/plugin.js",
  "sha256": "sha256 of plugin.js, lowercase hex"
}
```

- **`network`** lists every host `fetch` may reach. `*.example.org` covers
  its subdomains. `*` on its own, IP addresses and `localhost` are refused: a
  plugin names its sites. The user sees this list before installing.
- **`payload` and `sha256`.** The node downloads the code once, refuses it if
  the sum differs, and runs only that saved copy. A new version is a new
  manifest with a new sum; the user installs it with a click, and agrees again
  if it reaches new hosts.
- **`config`** fields become a form in the plugin's settings: `text`, `select`
  (with `options`) or `switch`. A `secret` field is kept out of the node's
  database and backups and is never sent back to the app.
- **Unknown fields are an error**, so a manifest written for a newer node is
  refused instead of half understood. `minNodeVersion` says which node it
  needs.

## The sandbox

The script gets `fetch`, `parseHTML`, `console` and `config` — nothing else.
No `require`, no files, no processes, no timers, no storage between calls:
every search starts in a fresh runtime.

| Limit | Value |
|---|---|
| One search, every request in it included | 30 s; then it is stopped, `catch` or not |
| One request | 15 s |
| Requests per search | 10 |
| Response body | 5 MB |
| Request body (POST) | 1 MB |
| Releases kept per search | 500 |
| Console lines per search | 50 |

`fetch` takes `GET` or `POST`, headers and a string body. `User-Agent`,
`Host` and the connection headers are the node's; setting one is an error.
There are no cookies kept between requests. A failed request rejects with an
`Error` saying why — catch it to try another way.

`parseHTML` takes the page as a string and returns a selection with `find`,
`first`, `eq`, `text`, `attr`, `each` (return `false` to stop) and `map`. A
selector that does not parse is an error, not an empty match.

Release fields that are not what [`plugin.d.ts`](plugin.d.ts) says are
dropped. A release without a title, or without a magnet link, a `.torrent`
link or an info hash, is left out; so is a `.torrent` link on a host the
manifest does not list, because the node downloads it later itself. Info
hashes may be hex or base32.

`fetch` checks every redirect against `network`, and refuses any host that
resolves to a loopback, private or link-local address — a plugin cannot reach
the node's own API or the user's local network, whatever its hosts point to.

Write JavaScript; if you write TypeScript, compile it yourself.
