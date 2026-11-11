// On-page JSON viewer: mount a read-only JSON editor over Chrome's raw <pre>,
// with an always-available 原始 / 树形 (raw / tree) toggle and the brand /
// support links in a top bar.
//
// Content scripts run in an isolated world where `customElements` is null, so
// the <json-editor> custom element CANNOT be registered here. Instead we render
// the shared `ViewerShell` Vue component (same component the last-preview page
// uses), which mounts the editor imperatively via `defineJsonEditor` and injects
// the inlined CSS itself. `src/editor/` is a local copy of the site's
// `packages/json-editor/src/` (JsonEditor.vue and siblings), so plugin-only UX
// changes never require publishing a new npm version.
import { createApp } from 'vue'
import { browser } from 'wxt/browser'
import ViewerShell from '../src/components/ViewerShell.vue'
import type { JsonEditorOptions } from '../src/editor/wc/defineJsonEditor'
import { type ExtensionOptions, resolveDark } from './options'
import { SITE_URL, KO_FI_URL } from './constants'

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
  /** Subscribe to live editor content changes; returns an unsubscribe fn. */
  onChange(callback: (value: string) => void): () => void
  /** Unmount the viewer and restore the page. */
  destroy(): void
}

interface ShellHandle {
  setOptions(options: JsonEditorOptions): void
  setLabels(labels: ViewerLabels): void
  onChange(callback: (value: string) => void): () => void
}

const ROOT_ID = 'jsontb-root'

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
  labels: ViewerLabels,
): ViewerController {
  const raw = doc.source

  // Chrome's built-in JSON viewer may render its own tree into this container
  // and hide the native <pre>. We take it over; on destroy we restore it so the
  // page returns to exactly what Chrome would have shown.
  const viewerContainer = document.querySelector<HTMLElement>('.json-formatter-container')
  const savedViewerDisplay = viewerContainer?.style.getPropertyValue('display') ?? ''
  const savedViewerPriority = viewerContainer?.style.getPropertyPriority('display') ?? ''
  function restoreViewerContainer(): void {
    if (!viewerContainer) return
    if (savedViewerDisplay) viewerContainer.style.setProperty('display', savedViewerDisplay, savedViewerPriority)
    else viewerContainer.style.removeProperty('display')
  }

  // ── Full-screen overlay (tree mode) ──────────────────────────────────────
  const viewerHost = fixedHost(ROOT_ID, { inset: '0', margin: '0', padding: '0', border: '0' })
  const root = viewerHost.attachShadow({ mode: 'open' })
  const container = document.createElement('div')
  container.style.height = '100%'
  root.appendChild(container)
  document.body.appendChild(viewerHost)

  // `setOptions()` normalizes the FULL options object — always pass `value`,
  // otherwise a config change would silently clear the editor.
  function editorOptions(next: ExtensionOptions): JsonEditorOptions {
    // Table view is only meaningful for array roots; for object/scalar roots we
    // drop the whole mode switcher (fixed split, nothing to toggle).
    const arrayRoot = /^\s*\[/.test(doc.text)
    return {
      value: doc.text,
      view: next.view ?? 'both',
      theme: resolveDark(next.theme) ? 'dark' : 'light',
      locale: next.locale,
      indent: next.indent,
      readOnly: false,
      height: '100%',
      attribution: false,
      imagePreview: next.imagePreview,
      allowedViews: arrayRoot ? ['both', 'table'] : [],
      searchInToolbar: true,
      bareImage: true,
      linkScroll: true,
    }
  }

  const wechatUrl = browser.runtime.getURL('/qr/wechat-pay.png')
  const alipayUrl = browser.runtime.getURL('/qr/alipay.png')
  const iconUrl = browser.runtime.getURL('/icon-32.png')

  // The shared shell renders the top bar, site/support links, the QR modal and
  // the raw/tree toggle; the editor itself is mounted inside it. This is the
  // exact same component the last-preview page uses, so the two hosts look and
  // behave identically.
  const app = createApp(ViewerShell, {
    editorOptions: editorOptions(options),
    labels,
    siteUrl: SITE_URL,
    kofiUrl: KO_FI_URL,
    wechatUrl,
    alipayUrl,
    iconUrl,
    hideAuto: true,
  })
  const shell = app.mount(container) as unknown as ShellHandle

  let destroyed = false

  function apply(next: ExtensionOptions, nextLabels: ViewerLabels): void {
    if (destroyed) return
    shell.setOptions(editorOptions(next))
    shell.setLabels(nextLabels)
  }

  function destroy(): void {
    if (destroyed) return
    destroyed = true
    app.unmount()
    restoreViewerContainer()
    viewerHost.remove()
  }

  apply(options, labels)

  return { apply, onChange: (cb) => shell.onChange(cb), destroy }
}
