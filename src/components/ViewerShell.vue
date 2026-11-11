<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import {
  defineJsonEditor,
  type JsonEditorInstance,
  type JsonEditorOptions,
} from '../editor/wc/defineJsonEditor'
import { editorCss } from '../editor/editorCss'
import { resolveDark } from '../../utils/options'

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
      <span class="title">{{ labels.title }}</span>
    </div>

    <!-- Always-visible top-right: raw/tree toggle + site + support links. -->
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

<style scoped>
.vsh {
  --v-bg: #ffffff;
  --v-fg: #0f172a;
  --v-bar-bg: #f8fafc;
  --v-line: #e2e8f0;
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: var(--v-bg);
  color: var(--v-fg);
  font: 14px/1.5 system-ui, -apple-system, sans-serif;
}
.vsh.dark {
  --v-bg: #020617;
  --v-fg: #f1f5f9;
  --v-bar-bg: #0f172a;
  --v-line: #1e293b;
}
.bar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  padding: 8px 14px;
  border-bottom: 1px solid var(--v-line);
  background: var(--v-bar-bg);
}
.title {
  font-size: 13px;
  font-weight: 700;
}
.topright {
  position: absolute;
  top: 8px;
  right: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 2;
}
.btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  box-sizing: border-box;
  line-height: 1;
  cursor: pointer;
  text-decoration: none;
  border: 1px solid var(--v-line);
  background: transparent;
  color: inherit;
  border-radius: 9999px;
  padding: 6px 12px;
  font: 600 12px system-ui, -apple-system, sans-serif;
}
.btn:hover {
  border-color: #0052d4;
  color: #0052d4;
}
.btn.site {
  background: #0052d4;
  color: #fff;
  border-color: transparent;
}
.btn.site:hover {
  background: #003ea8;
  color: #fff;
}
.btn.site .ext {
  font-size: 11px;
  opacity: 0.8;
}
.btn.kofi {
  background: transparent;
  color: #d97757;
  border-color: rgba(217, 119, 87, 0.55);
}
.btn.kofi:hover {
  background: rgba(217, 119, 87, 0.12);
  color: #d97757;
  border-color: rgba(217, 119, 87, 0.55);
}
.body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}
.je {
  display: block;
  height: 100%;
}
.raw {
  margin: 0;
  padding: 16px;
  height: 100%;
  box-sizing: border-box;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font: 13px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace;
}
.qr-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  font-family: system-ui, -apple-system, sans-serif;
}
.qr-card {
  background: #fff;
  color: #1f2937;
  border-radius: 16px;
  padding: 22px 24px 24px;
  width: 320px;
  max-width: calc(100vw - 32px);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
  position: relative;
  text-align: center;
}
.qr-card.dark {
  background: #1e293b;
  color: #e2e8f0;
}
.qr-title {
  font-size: 16px;
  font-weight: 700;
  margin: 0 0 4px;
}
.qr-sub {
  font-size: 12px;
  color: #64748b;
  margin: 0 0 18px;
}
.qr-card.dark .qr-sub {
  color: #94a3b8;
}
.qr-grid {
  display: flex;
  gap: 18px;
  justify-content: center;
}
.qr-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.qr-item img {
  width: 132px;
  height: 132px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  background: #fff;
  object-fit: contain;
}
.qr-card.dark .qr-item img {
  border-color: #334155;
  background: #fff;
}
.qr-item span {
  font-size: 13px;
  font-weight: 600;
}
.qr-close {
  position: absolute;
  top: 10px;
  right: 12px;
  border: 0;
  background: transparent;
  color: #94a3b8;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 8px;
}
.qr-close:hover {
  background: rgba(0, 0, 0, 0.06);
  color: #475569;
}
.qr-card.dark .qr-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
}
</style>
