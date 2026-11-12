# JSON Toolbox — browser extension

A WXT + Vue 3 companion extension for [jsontoolbox.cc](https://jsontoolbox.cc).
Chrome / Edge **Manifest V3**, `minimum_chrome_version: 116`, version `1.0.0`, MIT.

Source: [github.com/kbmjj123/json-browser-plugins](https://github.com/kbmjj123/json-browser-plugins)

## What it does

**One job:** automatically turn a raw JSON page into a readable, editable viewer.
The extension ships no JSON tools of its own — the tools live on the site.

### Three surfaces

| Surface | Trigger | Behaviour |
|---|---|---|
| **On-page overlay** | Open any URL whose whole document is JSON | A full-screen viewer in a shadow root covers the raw `<pre>`; the original page is left intact underneath |
| **Last-preview tab** | Click the toolbar icon | `action.onClicked` opens `lastPreview.html` with the most recently previewed JSON, or an empty editor you can paste into. There is intentionally **no action popup** (a popup suppresses `onClicked`) |
| **Settings popover** | ⚙ in either viewer's title bar | Six options, applied instantly to every open viewer via `storage.onChanged` |

Both viewers render the same `src/components/ViewerShell.vue`, so they look and behave identically. The title bar holds the ⚙ button, a Raw / Tree toggle, a `jsontoolbox.cc` link and a support link (Ko-fi, or a locally bundled WeChat / Alipay QR modal when the UI language is 中文).

There is no options page, no context menu, no side panel and no manual "Beautify" button.

### Automatic detection

Detection is deliberately conservative and **silent**: on any ordinary page the content script exits with zero DOM changes.

- Protocols: `http:`, `https:`, `file:`. Local `.json` files need "Allow access to file URLs" enabled on the extension card — that is a Chrome safeguard and cannot be coded around.
- Hosts `jsontoolbox.cc` and `www.jsontoolbox.cc` are excluded (exact match only; subdomains such as `resources.jsontoolbox.cc` are beautified normally).
- `<body>` must contain **exactly one** content-bearing child and it must be a `<pre>`. `script/style/noscript/template/link/meta/base/iframe`, Chrome's own `.json-formatter-container` and empty childless mount points are ignored. The `<pre>` may contain `<span>` children (Chrome's built-in JSON viewer).
- The text must start with `{` or `[`, parse as valid JSON, and be ≤ **2 MiB**.
- Any visible text outside that `<pre>` rejects the page.

### Viewer capabilities

The viewer is a **local copy** of the site's JSON editor (`src/editor/`), vendored so plugin-only UX changes need no npm release.

- CodeMirror 6 source editor + tree and split view; **editable** (not read-only), with node rename / type change / add / remove / move, bulk value set and 100-step undo/redo.
- Table view for array roots (column show/hide, header sorting, CSV export). The view switcher is hidden for object / scalar roots.
- Search by key, value, path, all or JSONPath: result drawer, cyclic prev/next, Enter / Shift+Enter, Esc, Ctrl/Cmd+F. 250 ms debounce, 5000-match / 400k-node caps, progressive 1500-row tree rendering.
- Value insights: colors, timestamps, JWT, base64, image / audio / video / PDF URLs, plain URLs, email, UUID, IPv4, markdown and regex.
- Image lightbox with counter, thumbnail strip, single / bulk download and keyboard navigation.
- Copy (document / value / path / JSONPath), download, error line + column in the status bar, split-pane resize and scroll sync.
- Raw / Tree toggle shows a `<pre>` inside the shell — the page's original `<pre>` stays untouched underneath the overlay.

### Settings

| Option | Values | Default |
|---|---|---|
| Theme | light / dark / auto (by local time) | auto |
| Indentation | 2 / 4 / Tab | 2 |
| Default view | editor / tree / both / table | both |
| Language | English / 中文 | en |
| Preview images & media | on / off | on |
| Auto-beautify JSON pages | on / off | on |

The last one is a config toggle, **not** a permission opt-in: beautification works from install. It is hidden inside the on-page overlay (turning it off there would destroy the overlay) and only shown in the last-preview tab. Changing a setting persists through `setOptions()` and both views react to `storage.onChanged` without a reload.

## Privacy & permissions

| Item | Value |
|---|---|
| `permissions` | `['storage']` |
| `content_scripts.matches` | `['<all_urls>', 'file:///*']`, `run_at: 'document_idle'` |
| `host_permissions` | not declared |
| Other manifest fields | `action: {}` (no popup), a service worker generated from `background.ts`, `default_locale: 'en'`, `homepage_url`, 4 icons, `minimum_chrome_version: '116'` |

**Chrome will show "Read and change all your data on all websites" at install.** That comes from the content-script match patterns: Chrome has no API to inject based on a response's `Content-Type`, so automatic detection needs a broad match. It is an accepted tradeoff; no explicit host permissions are requested.

What the code actually does:

- Reads the page's existing `<pre>` text, parses it in memory and renders into a shadow root. No remote scripts, no remote fonts, no `eval` / `new Function`, no analytics, and no server of ours receives anything.
- `browser.storage.local` holds two keys: `jsontb:options:v1` (the six settings) and `lastPreview` (`{ text, url, ts }` — the **actual JSON text** plus its source URL). Nothing is synced or uploaded; uninstalling the extension removes it.
- With **Preview images & media** on (the default), URLs found inside the JSON are loaded by the browser as `<img>` / `<audio>` / `<video>` / `<iframe>`, and "Download all" calls `fetch(url)` on them. Those requests go to the servers hosting those URLs and can expose tokens embedded in the URL. Turn the switch off to disable every third-party request. Inline `data:` / base64 images never make a request.
- All outbound links (`jsontoolbox.cc`, Ko-fi, the large-file viewer) open only on a user click. The QR images are bundled as data URIs.

The store listing and privacy policy must describe the local storage and the media-preview requests; do **not** claim "zero network requests" or "data never leaves your device".

## Architecture notes

- `src/editor/wc/defineJsonEditor.ts` mounts the editor imperatively into a nested shadow root. **Do not switch back to `<json-editor>` / `registerJsonEditor()`**: content scripts run in an isolated world where `customElements` is `null`, so a custom element can never be registered.
- `src/editor/editorCss.ts` injects the bundled stylesheet into that shadow root; components never write styles into the host page's `<head>`. `ViewerShell.css` / `ViewerSettings.css` are injected into whichever root the shell lives in.
- `src/editor/core/parse.ts` (`analyzeJson`) is the detection predicate used by `entrypoints/content.ts`.
- Viewer-only hardening: debounced/capped search, progressive flat-tree rendering, a hidden inner toolbar, `allowedViews` gated on an array root, and plain-CSS `--je-*` / `--v-*` tokens (no Tailwind runtime in the content script).
- `tsconfig.json` disables `noUncheckedIndexedAccess` and `noImplicitOverride` because the copied editor sources predate WXT's stricter defaults.
- Two independent locale systems: `public/_locales/{en,zh,zh_CN}/messages.json` drives manifest strings and `browser.i18n.getMessage` (follows the **browser UI language**; `zh_CN` is Chrome's standard Simplified Chinese code and the bare `zh` folder is kept for compatibility), while `src/editor/i18n/{en,zh}.ts` drives all viewer copy (follows the user's **Language** setting). There is no vue-i18n dependency.
- The four PNGs in `public/` came from the site's 512×512 app icon. Images used inside the viewer are imported with `?inline` so they survive a strict host-page CSP.

## Development

This is a standalone repository; scripts run from its own root.

| Script | Purpose |
|---|---|
| `dev` | HMR dev build for Chrome (`wxt -b chrome`) |
| `build` | produces `.output/chrome-mv3/` |
| `zip` | produces the uploadable zip |
| `compile` | `vue-tsc --noEmit` |
| `postinstall` | `wxt prepare` |

Load the unpacked extension from `chrome://extensions` → Developer mode → `.output/chrome-mv3`. WXT regenerates the literal `getMessage` key types from `_locales` and the auto-import types from `utils/` / `composables/` during `prepare`, so regenerate them after editing locale files or adding/removing sources there. `.wxt/` is a generated directory and must not be edited by hand.

`tailwind.config.js` / `postcss.config.cjs` are kept so Vite's autoprefixer step keeps working; no stylesheet uses Tailwind directives anymore and no Tailwind runtime is bundled.

### Manual verification

1. Open a `.json` URL → overlay appears; the original `<pre>` is untouched underneath; the title bar shows ⚙, Raw/Tree, site and support links.
2. Raw → text view; Tree → editor returns.
3. `https://example.com`, a blog post with `<pre><code>{...}</code></pre>`, a GitHub blob → no overlay, no toast, no DOM change.
4. `https://jsontoolbox.cc/...` unaffected; `https://resources.jsontoolbox.cc/orders-1mb.json` beautified.
5. Change theme / indent / view / language in ⚙ → applies live without a reload.
6. Turn auto-beautify off in the last-preview tab → the overlay is removed and the native `<pre>` shows again; on → re-mounts.
7. Set Language = 中文 → viewer copy switches and the support link opens the QR modal.
8. DevTools Network: no requests of our own; with media previews off, no third-party requests either.

## Store listing

- Name and short description (≤132 chars) live in `public/_locales/{en,zh,zh_CN}/messages.json` (`extName` / `extDescription`) and are the source of `name` / `description` in the generated manifest. The detailed description, category (Developer Tools), privacy policy URL, permission justifications and promo assets are filled in the store dashboard.
- Required assets: a 128×128 store icon (`public/icon-128.png`), at least one and up to five 1280×800 screenshots, and a 440×280 small promo tile. A 1400×560 marquee image and a demo video are optional.
- `demo/object-showcase.json` and `demo/table-orders.json` are sample documents for screenshots and manual testing (object root for tree / search / value insights, array root for table / sorting / CSV export). They are **not** bundled into the extension.
- `scripts/capture-screenshots.cjs` regenerates the five 1280×800 PNGs in `store-assets/` with Playwright. It loads a staged copy of `.output/chrome-mv3` with the Chinese locales stripped, so `chrome.i18n` falls back to English and the real build output is untouched. The Chromium executable path is pinned to this machine's `chromium-1223`.
- `scripts/generate-promo-images.cjs` renders `store-assets/promo-440x280.png` (required small promo tile) and `store-assets/marquee-1400x560.png` (optional marquee) from HTML/CSS with no image library. The marquee embeds screenshot 01, so regenerate the screenshots first.

`docs/popup-config-integration.md` is a historical design document from the removed-popup refactor and no longer describes the current code.

## Not in v1

- Intercepting `fetch` / `XMLHttpRequest` JSON responses (needs MAIN-world monkey-patching, brittle under MV3 CSP).
- Code splitting for the content script (WXT builds content scripts as a single IIFE).
- Firefox / Safari builds and additional store locales.
- Known rough edges: editing in the last-preview tab writes to `storage.local` without a size cap or error handling; re-applying settings resets the editor to the text it was mounted with.
