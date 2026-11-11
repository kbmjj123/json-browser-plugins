import { createApp, type ComponentPublicInstance } from 'vue'
import { browser } from 'wxt/browser'
import ViewerShell from '../../src/components/ViewerShell.vue'
import type { JsonEditorOptions } from '../../src/editor/wc/defineJsonEditor'
import { getOptions, STORAGE_KEY, DEFAULT_OPTIONS, resolveDark, type ExtensionOptions } from '../../utils/options'
import { SITE_URL, KO_FI_URL } from '../../utils/constants'
// Inlined at build time so extension images are data URIs. Although this page is
// an extension page (where `chrome-extension://` works), keeping them inline
// makes the two hosts identical and immune to any host-page behaviour.
import iconDataUrl from '../../public/icon-32.png?inline'
import wechatDataUrl from '../../public/qr/wechat-pay.png?inline'
import alipayDataUrl from '../../public/qr/alipay.png?inline'

const LAST_PREVIEW_KEY = 'lastPreview'

interface LastPreview {
  text: string
  url: string
  ts: number
}

// Keep in sync with ViewerShell's ShellLabels.
interface ViewerShellLabels {
  title: string
  raw: string
  tree: string
  site: string
}

interface ShellHandle {
  setOptions(o: JsonEditorOptions): void
  setLabels(l: ViewerShellLabels): void
  onChange(cb: (value: string) => void): () => void
}

function buildOptions(next: ExtensionOptions, value: string): JsonEditorOptions {
  const arrayRoot = /^\s*\[/.test(value)
  return {
    value,
    view: next.view ?? 'both',
    theme: resolveDark(next.theme) ? 'dark' : 'light',
    locale: next.locale,
    indent: next.indent,
    readOnly: false,
    height: '100%',
    attribution: false,
    imagePreview: next.imagePreview,
    // Table is only meaningful for array roots; object/scalar roots keep the
    // fixed split with no mode switcher.
    allowedViews: arrayRoot ? ['both', 'table'] : [],
    searchInToolbar: true,
    bareImage: true,
    linkScroll: true,
  }
}

async function main(): Promise<void> {
  const host = document.getElementById('app')
  if (!host) return

  let opts: ExtensionOptions
  try {
    opts = await getOptions()
  } catch {
    opts = DEFAULT_OPTIONS
  }

  let stored: { lastPreview?: LastPreview } = {}
  try {
    stored = await browser.storage.local.get(LAST_PREVIEW_KEY)
  } catch {
    stored = {}
  }
  const preview = stored.lastPreview

  // Always render the viewer. With no stored preview we show an empty workspace
  // (the user can paste/type) instead of a "nothing yet" message.
  const value = preview && typeof preview.text === 'string' ? preview.text : ''

  if (preview && typeof preview.url === 'string') {
    try {
      const url = new URL(preview.url)
      document.title = `JSON Preview · ${url.hostname}`
    } catch {
      document.title = 'JSON Preview'
    }
  } else {
    document.title = 'JSON Preview'
  }

  const labels: ViewerShellLabels = {
    title: document.title,
    raw: browser.i18n.getMessage('viewerRaw'),
    tree: browser.i18n.getMessage('viewerTree'),
    site: browser.i18n.getMessage('extName'),
  }

  const editorOptions = buildOptions(opts, value)
  const wechatUrl = wechatDataUrl
  const alipayUrl = alipayDataUrl
  const iconUrl = iconDataUrl

  const shellApp = createApp(ViewerShell, {
    editorOptions,
    labels,
    siteUrl: SITE_URL,
    kofiUrl: KO_FI_URL,
    wechatUrl,
    alipayUrl,
    iconUrl,
  })
  const shell = shellApp.mount(host) as unknown as ShellHandle & ComponentPublicInstance

  // Keep the stored preview in sync with live edits in the left pane.
  shell.onChange((v) => {
    void browser.storage.local.set({
      [LAST_PREVIEW_KEY]: { text: v, url: location.href, ts: Date.now() },
    })
  })

  // Live-apply config changes made elsewhere (e.g. another view or options).
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return
    const change = changes[STORAGE_KEY]
    if (!change) return
    const next = { ...opts, ...((change.newValue as Partial<ExtensionOptions>) ?? {}) }
    opts = next
    shell.setOptions(buildOptions(next, value))
  })
}

function showError(msg: string): void {
  const el = document.getElementById('app')
  if (el) {
    el.innerHTML =
      `<pre style="margin:0;padding:20px;color:#b91c1c;font:13px/1.5 ui-monospace,monospace;white-space:pre-wrap">${msg}</pre>`
  }
}
window.addEventListener('error', (e) => showError(e.message))
window.addEventListener('unhandledrejection', (e) =>
  showError('Unhandled rejection: ' + String((e as PromiseRejectionEvent).reason)),
)

void main()
