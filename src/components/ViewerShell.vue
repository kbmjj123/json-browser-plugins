<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import {
  defineJsonEditor,
  type JsonEditorInstance,
  type JsonEditorOptions,
} from '../editor/wc/defineJsonEditor'
import { editorCss } from '../editor/editorCss'
import { resolveDark } from '../../utils/options'
import { injectStylesIntoRoot } from '../../utils/injectShadowStyles'
import { createTranslator, type Locale } from '../editor/i18n'
import viewerShellCss from './ViewerShell.css?inline'
import ViewerSettings from './ViewerSettings.vue'

export interface ShellLabels {
  title: string
  raw: string
  tree: string
  /** Brand label for the always-visible top-right site link. */
  site: string
}

const props = defineProps<{
  editorOptions: JsonEditorOptions
  labels: ShellLabels
  siteUrl: string
  kofiUrl: string
  wechatUrl?: string
  alipayUrl?: string
  /** Extension icon shown at the left of the title bar. Empty hides it. */
  iconUrl?: string
  /** Hide the auto-beautify toggle inside the settings panel. Used by the page
   *  overlay, where turning auto off would destroy the overlay itself. */
  hideAuto?: boolean
}>()

// The icon is inlined as a data URI by the hosts, but on a strict-CSP page even a
// data: <img> can be blocked. Fall back to an inline SVG (pure markup, no
// subresource) so the title bar always shows *something* on the left.
const iconError = ref(false)
// Same strict-CSP hazard for the support QR codes: hide a QR if its data URI is
// ever blocked, instead of showing a broken-image glyph.
const qrErrorW = ref(false)
const qrErrorA = ref(false)

const emit = defineEmits<{ change: [value: string] }>()

// `editorOptions`/`labels` are copied into refs so the host (content script or
// the last-preview page) can push live updates via the exposed setters without
// mutating readonly props.
const opts = ref<JsonEditorOptions>(props.editorOptions)
const labels = ref<ShellLabels>(props.labels)

const dark = computed(() => resolveDark(opts.value.theme))
// The QR / Ko-fi behaviour follows the locale, so it updates live when the user
// switches language in the settings panel (no separate `showQr` prop needed).
const showQr = computed(() => opts.value.locale === 'zh')
const mode = ref<'tree' | 'raw'>('tree')
const showQrModal = ref(false)
const showSettings = ref(false)

// Raw/tree toggle copy is driven by the user-chosen locale (the same source the
// editor and settings panel use), so switching language relabels it instantly.
const t = computed(() =>
  createTranslator((opts.value.locale === 'zh' ? 'zh' : 'en') as Locale),
)

const toggleLabel = computed(() =>
  mode.value === 'tree' ? t.value('raw') : t.value('tree'),
)

function toggle(): void {
  mode.value = mode.value === 'tree' ? 'raw' : 'tree'
}

function toggleSettings(): void {
  showSettings.value = !showSettings.value
}

function onKofi(e: Event): void {
  if (showQr.value && props.wechatUrl) {
    e.preventDefault()
    showQrModal.value = true
  }
}
function closeQr(): void {
  showQrModal.value = false
}

// Close the settings popover when the user clicks/taps anywhere outside it.
// Clicks inside a shadow root retarget `event.target` to the host when observed
// from `document`, so we use `composedPath()` (which keeps the true internal
// nodes) to test membership of the popover wrapper.
const settingsWrapEl = ref<HTMLElement | null>(null)
function onDocPointerDown(e: Event): void {
  if (!showSettings.value) return
  const wrap = settingsWrapEl.value
  if (wrap && !e.composedPath().includes(wrap)) showSettings.value = false
}
function onDocKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && showSettings.value) showSettings.value = false
}

const changeCbs = new Set<(value: string) => void>()
function onEdit(value: string): void {
  for (const cb of changeCbs) cb(value)
}

// Editor is mounted imperatively via defineJsonEditor so the editor stylesheet
// (editorCss) is injected into its own nested shadow — exactly like the
// content-script path. This keeps the two hosts rendering identically.
const editorMount = ref<HTMLDivElement | null>(null)
let editor: JsonEditorInstance | null = null

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown)
  document.addEventListener('keydown', onDocKeyDown)

  const mount = editorMount.value
  if (!mount) return

  // Inject the shell chrome CSS into whichever root we are mounted in. The
  // content-script path mounts us inside a shadow root (so `:host` resets the
  // host div and the CSS cannot leak to the page); the last-preview page mounts
  // us in the light DOM, where we fall back to `document.head`. Vue's native
  // `<style scoped>` would land in `document.head` and fail to pierce the shadow
  // boundary, which is exactly why these styles are injected manually here.
  const rootNode = mount.getRootNode()
  injectStylesIntoRoot(
    rootNode,
    'viewer-shell',
    viewerShellCss,
    { hostReset: rootNode instanceof ShadowRoot },
  )

  const root = mount.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = `:host { display: block; height: 100% }\n${editorCss}`
  const inner = document.createElement('div')
  inner.style.height = '100%'
  root.append(style, inner)
  editor = defineJsonEditor(inner, opts.value)
  editor.on('change', onEdit)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown)
  document.removeEventListener('keydown', onDocKeyDown)
  editor?.destroy()
  editor = null
})

defineExpose({
  setOptions(o: JsonEditorOptions) {
    opts.value = o
    editor?.setOptions(o)
  },
  setLabels(l: ShellLabels) {
    labels.value = l
  },
  onChange(cb: (value: string) => void) {
    changeCbs.add(cb)
    return () => changeCbs.delete(cb)
  },
})
</script>

<template>
  <div class="vsh" :class="{ dark }">
    <div class="bar">
      <img
        v-if="iconUrl && !iconError"
        class="logo"
        :src="iconUrl"
        :alt="labels.site"
        @error="iconError = true"
      />
      <svg
        v-else
        class="logo"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M8 4H6a2 2 0 0 0-2 2v2M16 4h2a2 2 0 0 1 2 2v2" />
        <path d="M8 20H6a2 2 0 0 1-2-2v-2M16 20h2a2 2 0 0 0 2-2v-2" />
        <path d="M9 9l-3 3 3 3M15 9l3 3-3 3" />
      </svg>
      <span class="title">{{ labels.title }}</span>

      <!-- Always-visible right side: settings + raw/tree toggle + site + support. -->
      <div class="topright">
        <div class="settings-wrap" ref="settingsWrapEl">
          <button
            class="btn icon"
            type="button"
            :aria-label="t('settings')"
            :aria-expanded="showSettings"
            @click="toggleSettings"
          >
            ⚙
          </button>
          <div v-if="showSettings" class="settings-pop">
            <ViewerSettings
              :locale="(opts.locale === 'zh' ? 'zh' : 'en') as 'en' | 'zh'"
              :hide-auto="hideAuto"
              :site-url="siteUrl"
              @close="showSettings = false"
            />
          </div>
        </div>
        <button class="btn toggle" type="button" @click="toggle">
          {{ toggleLabel }}
        </button>
        <a class="btn site" :href="siteUrl" target="_blank" rel="noopener">
          {{ labels.site }}<span class="ext">↗</span>
        </a>
        <a
          class="btn kofi"
          :href="kofiUrl"
          target="_blank"
          rel="noopener"
          @click="onKofi"
        >
          {{ showQr ? '☕ 请喝咖啡' : '☕ Buy me a coffee' }}
        </a>
      </div>
    </div>

    <div class="body">
      <div v-show="mode === 'tree'" ref="editorMount" class="je"></div>
      <pre v-show="mode === 'raw'" class="raw">{{ opts.value }}</pre>
    </div>

    <div v-if="showQrModal" class="qr-backdrop" @click.self="closeQr">
      <div class="qr-card" :class="{ dark }">
        <button class="qr-close" type="button" aria-label="关闭" @click="closeQr">
          ×
        </button>
        <p class="qr-title">请我喝杯咖啡 ☕</p>
        <p class="qr-sub">微信或支付宝扫码，感谢你的支持！</p>
        <div class="qr-grid">
          <div v-if="wechatUrl" class="qr-item">
            <img v-if="!qrErrorW" :src="wechatUrl" alt="微信支付" @error="qrErrorW = true" />
            <span>微信支付</span>
          </div>
          <div v-if="alipayUrl" class="qr-item">
            <img v-if="!qrErrorA" :src="alipayUrl" alt="支付宝" @error="qrErrorA = true" />
            <span>支付宝</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
