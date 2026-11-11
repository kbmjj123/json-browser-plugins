<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import {
  defineJsonEditor,
  type JsonEditorInstance,
  type JsonEditorOptions,
} from '../editor/wc/defineJsonEditor'
import { editorCss } from '../editor/editorCss'
import { resolveDark } from '../../utils/options'
import viewerShellCss from './ViewerShell.css?inline'

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
  /** Chinese locale shows the payment-QR modal instead of visiting Ko-fi. */
  showQr?: boolean
}>()

const emit = defineEmits<{ change: [value: string] }>()

// `editorOptions`/`labels` are copied into refs so the host (content script or
// the last-preview page) can push live updates via the exposed setters without
// mutating readonly props.
const opts = ref<JsonEditorOptions>(props.editorOptions)
const labels = ref<ShellLabels>(props.labels)

const dark = computed(() => resolveDark(opts.value.theme))
const mode = ref<'tree' | 'raw'>('tree')
const showQrModal = ref(false)

const toggleLabel = computed(() =>
  mode.value === 'tree' ? labels.value.raw : labels.value.tree,
)

function toggle(): void {
  mode.value = mode.value === 'tree' ? 'raw' : 'tree'
}

function onKofi(e: Event): void {
  if (props.showQr && props.wechatUrl) {
    e.preventDefault()
    showQrModal.value = true
  }
}
function closeQr(): void {
  showQrModal.value = false
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
  const mount = editorMount.value
  if (!mount) return

  // Inject the shell chrome CSS into whichever root we are mounted in. The
  // content-script path mounts us inside a shadow root (so `:host` resets the
  // host div and the CSS cannot leak to the page); the last-preview page mounts
  // us in the light DOM, where we fall back to `document.head`. Vue's native
  // `<style scoped>` would land in `document.head` and fail to pierce the shadow
  // boundary, which is exactly why these styles are injected manually here.
  const rootNode = mount.getRootNode()
  const SHELL_STYLE_ID = 'viewer-shell-styles'
  if (rootNode instanceof ShadowRoot) {
    if (!rootNode.getElementById(SHELL_STYLE_ID)) {
      const style = document.createElement('style')
      style.id = SHELL_STYLE_ID
      style.textContent = `:host { all: initial }\n${viewerShellCss}`
      rootNode.appendChild(style)
    }
  } else if (rootNode === document) {
    if (!document.getElementById(SHELL_STYLE_ID)) {
      const style = document.createElement('style')
      style.id = SHELL_STYLE_ID
      style.textContent = viewerShellCss
      document.head.appendChild(style)
    }
  }

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
      <img v-if="iconUrl" class="logo" :src="iconUrl" :alt="labels.site" />
      <span class="title">{{ labels.title }}</span>

      <!-- Always-visible right side: raw/tree toggle + site + support links. -->
      <div class="topright">
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
      <pre v-show="mode === 'raw'" class="raw">{{ opts.value.value }}</pre>
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
            <img :src="wechatUrl" alt="微信支付" />
            <span>微信支付</span>
          </div>
          <div v-if="alipayUrl" class="qr-item">
            <img :src="alipayUrl" alt="支付宝" />
            <span>支付宝</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
