// On-page JSON viewer: mount a read-only JSON editor over Chrome's raw <pre>,
// with an always-available 原始 / 树形 (raw / tree) toggle.
//
// Content scripts run in an isolated world where `customElements` is null, so
// the <json-editor> custom element CANNOT be registered here. Use the copied
// editor's imperative `defineJsonEditor()` instead and inject its inlined CSS
// ourselves. `src/editor/` is a local copy of the site's
// `packages/json-editor/src/` (JsonEditor.vue and siblings), so plugin-only UX
// changes never require publishing a new npm version.
import { defineJsonEditor, type JsonEditorInstance, type JsonEditorOptions } from '../src/editor/wc/defineJsonEditor'
import { editorCss } from '../src/editor/editorCss'
import { resolveDark, type ExtensionOptions } from './options'
import { SITE_URL } from './constants'
import { browser } from 'wxt/browser'

export interface JsonDocument {
  text: string
  /** The single <pre> that holds the raw JSON. */
  source: HTMLElement
}

export interface ViewerLabels {
  title: string
  raw: string
  tree: string
  /** Brand label for the always-visible top-right site link. */
  site: string
}

export interface ViewerController {
  /** Re-apply config live (called from storage.onChanged). */
  apply(options: ExtensionOptions, labels: ViewerLabels): void
  /** Restore the native <pre> and unmount the Vue app. */
  destroy(): void
}

const ROOT_ID = 'jsontb-root'
const SITELINK_ID = 'jsontb-sitelink'

function fixedHost(id: string, extra: Record<string, string>): HTMLDivElement {
  const host = document.createElement('div')
  host.id = id
  host.style.setProperty('position', 'fixed', 'important')
  host.style.setProperty('z-index', '2147483647', 'important')
  for (const [prop, value] of Object.entries(extra)) {
    host.style.setProperty(prop, value, 'important')
  }
  return host
}

export function detectAndMount(
  doc: JsonDocument,
  options: ExtensionOptions,
  labels: ViewerLabels
): ViewerController {
  const raw = doc.source
  // Remember the original inline display (value + priority) so 「原始」 restores
  // exactly what the page had. We only ever set `display` ourselves.
  const savedDisplay = raw.style.getPropertyValue('display')
  const savedPriority = raw.style.getPropertyPriority('display')

  // Chrome's built-in JSON viewer renders its own tree into this container and
  // may hide the native <pre>. Take it over so "Raw" always shows plain text and
  // our tree overlay never sits on top of a second tree.
  const viewerContainer = document.querySelector<HTMLElement>('.json-formatter-container')
  const savedViewerDisplay = viewerContainer?.style.getPropertyValue('display') ?? ''
  const savedViewerPriority = viewerContainer?.style.getPropertyPriority('display') ?? ''

  function restoreRawDisplay(): void {
    if (savedDisplay) raw.style.setProperty('display', savedDisplay, savedPriority)
    else raw.style.removeProperty('display')
  }

  function restoreViewerContainer(): void {
    if (!viewerContainer) return
    if (savedViewerDisplay) viewerContainer.style.setProperty('display', savedViewerDisplay, savedViewerPriority)
    else viewerContainer.style.removeProperty('display')
  }

  function showRawText(): void {
    restoreRawDisplay()
    // Chrome's viewer may have hidden the <pre> itself (display:none); force the
    // plain JSON text visible when the user switches to Raw.
    if (raw.style.getPropertyValue('display') === 'none') raw.style.removeProperty('display')
    viewerContainer?.style.setProperty('display', 'none', 'important')
  }

  // ── Full-screen overlay (tree mode) ──────────────────────────────────────
  const viewerHost = fixedHost(ROOT_ID, { inset: '0', margin: '0', padding: '0', border: '0' })
  viewerHost.style.setProperty('display', 'none', 'important')
  const root = viewerHost.attachShadow({ mode: 'open' })

  const styleEl = document.createElement('style')
  root.appendChild(styleEl)

  const wrap = document.createElement('div')
  wrap.className = 'wrap'

  const bar = document.createElement('div')
  bar.className = 'bar'
  const title = document.createElement('span')
  title.className = 'title'

  const barToggle = document.createElement('button')
  barToggle.type = 'button'
  bar.append(title, barToggle)

  const body = document.createElement('div')
  body.className = 'body'

  // Nested shadow root: editor CSS stays isolated from our overlay CSS.
  const editorMount = document.createElement('div')
  editorMount.className = 'je-mount'
  const editorRoot = editorMount.attachShadow({ mode: 'open' })
  const editorStyle = document.createElement('style')
  editorStyle.textContent = `:host { display: block; height: 100% }\n${editorCss}`
  const editorInner = document.createElement('div')
  editorInner.style.height = '100%'
  editorRoot.append(editorStyle, editorInner)
  body.appendChild(editorMount)

  // `setOptions()` normalizes the FULL options object — always pass `value`,
  // otherwise a config change would silently clear the editor.
  function editorOptions(next: ExtensionOptions): JsonEditorOptions {
    return {
      value: doc.text,
      view: 'both',
      theme: resolveDark(next.theme) ? 'dark' : 'light',
      locale: next.locale,
      indent: next.indent,
      readOnly: false,
      height: '100%',
      attribution: false,
      imagePreview: next.imagePreview,
      // Plugin-only UX: split-first, a single toolbar row with the view
      // switcher on the right, chevron expand toggles, bare image values, and
      // synced split-pane scrolling.
      allowedViews: [],
      searchInToolbar: true,
      bareImage: true,
      linkScroll: true,
    }
  }

  // NO `attribution` — the single site link lives in the toolbar above.
  const editor: JsonEditorInstance = defineJsonEditor(editorInner, editorOptions(options))
  wrap.append(bar, body)
  root.appendChild(wrap)
  document.body.appendChild(viewerHost)

  // ── Floating "back to tree" button (raw mode only) ─────────────────────
  // Switching to raw hides the overlay (and its in-bar toggle), so we surface
  // a standalone button to return to the JSON tree preview.
  const rawHost = fixedHost('jsontb-rawtoggle', { top: '0', left: '16px' })
  const rawRoot = rawHost.attachShadow({ mode: 'open' })
  const rawStyle = document.createElement('style')
  rawStyle.textContent = `
    :host { all: initial }
    a, button { display: inline-flex; align-items: center; gap: 4px;
      cursor: pointer; text-decoration: none; margin-top: 8px;
      background: #0052D4; color: #fff; border: 0; border-radius: 9999px;
      padding: 7px 13px; box-shadow: 0 4px 14px rgba(0,0,0,.18);
      font: 600 12px system-ui, -apple-system, sans-serif }
    a:hover, button:hover { background: #003ea8 }
  `
  const rawAnchor = document.createElement('button')
  rawAnchor.type = 'button'
  rawAnchor.textContent = labels.tree
  rawAnchor.addEventListener('click', toggle)
  rawRoot.append(rawStyle, rawAnchor)
  rawHost.style.display = 'none'
  document.body.appendChild(rawHost)

  let mode: 'tree' | 'raw' = 'tree'
  let currentLabels = labels
  let destroyed = false

  function paint(dark: boolean): void {
    const line = dark ? '#334155' : '#e2e8f0'
    const barLine = dark ? '#1e293b' : '#e2e8f0'
    const bg = dark ? '#020617' : '#ffffff'
    const fg = dark ? '#f1f5f9' : '#0f172a'
    const barBg = dark ? '#0f172a' : '#f8fafc'

    styleEl.textContent = `
      :host { all: initial }
      .wrap { position: fixed; inset: 0; display: flex; flex-direction: column;
        background: ${bg}; color: ${fg};
        font: 14px/1.5 system-ui, -apple-system, sans-serif }
      .bar { flex: 0 0 auto; display: flex; align-items: center; gap: 12px;
        padding: 8px 14px; border-bottom: 1px solid ${barLine}; background: ${barBg} }
      .title { font-size: 13px; font-weight: 700 }
      .title a { color: #0052D4; text-decoration: none; margin-left: 8px; font-weight: 600 }
      button { cursor: pointer; border: 1px solid ${line}; background: transparent;
        color: inherit; border-radius: 8px; padding: 5px 12px;
        font: 600 12px system-ui, -apple-system, sans-serif }
      button:hover { border-color: #0052D4; color: #0052D4 }
      .body { flex: 1 1 auto; min-height: 0; overflow: hidden }
      .je-mount { display: block; height: 100% }
    `
  }

  function updateLabels(): void {
    // While in tree mode the button offers 「原始」; while in raw mode it offers 「树形」.
    const label = mode === 'tree' ? currentLabels.raw : currentLabels.tree
    barToggle.textContent = label
  }

  function setMode(next: 'tree' | 'raw'): void {
    if (destroyed) return
    mode = next
    if (next === 'tree') {
      raw.style.setProperty('display', 'none', 'important')
      viewerContainer?.style.setProperty('display', 'none', 'important')
      viewerHost.style.setProperty('display', 'block', 'important')
      rawHost.style.display = 'none'
    } else {
      showRawText()
      viewerHost.style.setProperty('display', 'none', 'important')
      rawHost.style.display = 'block'
    }
    updateLabels()
  }

  function toggle(): void {
    setMode(mode === 'tree' ? 'raw' : 'tree')
  }
  barToggle.addEventListener('click', toggle)

  // ── Always-visible top-right links (both raw and tree modes) ─────────────
  // A site link drives traffic back home, and a "buy me a coffee" support link
  // thanks users. Appended last so they sit above the overlay.
  const KO_FI_URL = 'https://ko-fi.com/kbmjj123'
  const kofiText = options.locale === 'zh' ? '☕ 请喝咖啡' : '☕ Buy me a coffee'
  const siteHost = fixedHost(SITELINK_ID, { top: '0', right: '16px' })
  const siteRoot = siteHost.attachShadow({ mode: 'open' })
  const siteStyle = document.createElement('style')
  siteStyle.textContent = `
    :host { all: initial }
    .row { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
    a { display: inline-flex; align-items: center; gap: 4px;
      box-sizing: border-box; line-height: 1;
      cursor: pointer; text-decoration: none;
      background: #0052D4; color: #fff; border: 1px solid transparent; border-radius: 9999px;
      padding: 7px 13px; box-shadow: 0 4px 14px rgba(0,0,0,.18);
      font: 600 12px system-ui, -apple-system, sans-serif }
    a:hover { background: #003ea8 }
    a.site::after { content: ' ↗' }
    a.kofi {
      background: transparent;
      color: #d97757;
      border-color: rgba(217,119,87,.55);
      box-shadow: none;
    }
    a.kofi:hover { background: rgba(217,119,87,.12); }
  `
  const siteAnchor = document.createElement('a')
  siteAnchor.className = 'site'
  siteAnchor.href = SITE_URL
  siteAnchor.target = '_blank'
  siteAnchor.rel = 'noopener'
  siteAnchor.textContent = currentLabels.site

  const kofiAnchor = document.createElement('a')
  kofiAnchor.className = 'kofi'
  kofiAnchor.href = KO_FI_URL
  kofiAnchor.target = '_blank'
  kofiAnchor.rel = 'noopener'
  kofiAnchor.textContent = kofiText

  const siteRow = document.createElement('div')
  siteRow.className = 'row'
  siteRow.append(siteAnchor, kofiAnchor)
  siteRoot.append(siteStyle, siteRow)
  document.body.appendChild(siteHost)

  // ── "Buy me a coffee" QR modal (Chinese locale only) ─────────────────────
  // Ko-fi is unavailable in mainland China, so zh users get a modal with WeChat
  // / Alipay payment QR codes instead of being sent to ko-fi.com.
  const wechatUrl = browser.runtime.getURL('/qr/wechat-pay.png')
  const alipayUrl = browser.runtime.getURL('/qr/alipay.png')
  const qrHost = fixedHost('jsontb-qr', { inset: '0' })
  const qrRoot = qrHost.attachShadow({ mode: 'open' })
  const qrStyle = document.createElement('style')
  qrStyle.textContent = `
    :host { all: initial }
    .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.55);
      display: flex; align-items: center; justify-content: center; z-index: 1;
      font-family: system-ui, -apple-system, sans-serif }
    .card { background: #fff; color: #1f2937; border-radius: 16px;
      padding: 22px 24px 24px; width: 320px; max-width: calc(100vw - 32px);
      box-shadow: 0 20px 60px rgba(0,0,0,.35); position: relative; text-align: center }
    .card.dark { background: #1e293b; color: #e2e8f0 }
    .title { font-size: 16px; font-weight: 700; margin: 0 0 4px }
    .sub { font-size: 12px; color: #64748b; margin: 0 0 18px }
    .card.dark .sub { color: #94a3b8 }
    .grid { display: flex; gap: 18px; justify-content: center }
    .item { display: flex; flex-direction: column; align-items: center; gap: 8px }
    .item img { width: 132px; height: 132px; border-radius: 10px;
      border: 1px solid #e2e8f0; background: #fff; object-fit: contain }
    .card.dark .item img { border-color: #334155; background: #fff }
    .item span { font-size: 13px; font-weight: 600 }
    .close { position: absolute; top: 10px; right: 12px; border: 0;
      background: transparent; color: #94a3b8; font-size: 22px; line-height: 1;
      cursor: pointer; padding: 2px 6px; border-radius: 8px }
    .close:hover { background: rgba(0,0,0,.06); color: #475569 }
    .card.dark .close:hover { background: rgba(255,255,255,.1); color: #cbd5e1 }
  `
  const qrBackdrop = document.createElement('div')
  qrBackdrop.className = 'backdrop'
  const qrCard = document.createElement('div')
  qrCard.className = 'card' + (resolveDark(options.theme) ? ' dark' : '')
  const qrTitle = document.createElement('p')
  qrTitle.className = 'title'
  qrTitle.textContent = '请我喝杯咖啡 ☕'
  const qrSub = document.createElement('p')
  qrSub.className = 'sub'
  qrSub.textContent = '微信或支付宝扫码，感谢你的支持！'
  const qrGrid = document.createElement('div')
  qrGrid.className = 'grid'
  function makeQrItem(url: string, label: string): HTMLElement {
    const item = document.createElement('div')
    item.className = 'item'
    const img = document.createElement('img')
    img.src = url
    img.alt = label
    const span = document.createElement('span')
    span.textContent = label
    item.append(img, span)
    return item
  }
  qrGrid.append(makeQrItem(wechatUrl, '微信支付'), makeQrItem(alipayUrl, '支付宝'))
  const qrClose = document.createElement('button')
  qrClose.className = 'close'
  qrClose.type = 'button'
  qrClose.setAttribute('aria-label', '关闭')
  qrClose.textContent = '×'
  qrCard.append(qrClose, qrTitle, qrSub, qrGrid)
  qrBackdrop.append(qrCard)
  qrRoot.append(qrStyle, qrBackdrop)
  qrHost.style.display = 'none'
  document.body.appendChild(qrHost)

  function openQrModal(): void {
    qrHost.style.display = 'block'
  }
  function closeQrModal(): void {
    qrHost.style.display = 'none'
  }
  qrBackdrop.addEventListener('click', (e) => { if (e.target === qrBackdrop) closeQrModal() })
  qrClose.addEventListener('click', closeQrModal)

  // zh locale: show the payment QR modal; everyone else goes to Ko-fi.
  kofiAnchor.addEventListener('click', (e) => {
    if (options.locale === 'zh') {
      e.preventDefault()
      openQrModal()
    }
  })

  function apply(next: ExtensionOptions, nextLabels: ViewerLabels): void {
    if (destroyed) return
    currentLabels = nextLabels
    const dark = resolveDark(next.theme)
    editor.setOptions(editorOptions(next))
    title.textContent = nextLabels.title
    siteAnchor.textContent = nextLabels.site
    paint(dark)
    updateLabels()
  }

  function destroy(): void {
    if (destroyed) return
    destroyed = true
    editor.destroy() // no custom element → no disconnectedCallback to do this
    restoreRawDisplay()
    restoreViewerContainer()
    siteHost.remove()
    rawHost.remove()
    qrHost.remove()
    viewerHost.remove()
  }

  apply(options, labels)
  setMode('tree') // auto-beautify: tree is the default view

  return { apply, destroy }
}
