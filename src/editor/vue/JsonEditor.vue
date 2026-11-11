<template>
  <div
    class="je-root"
    :class="{ 'je-dark': isDark, 'je-flat': !bordered }"
    :style="{ height: resolvedHeight }"
  >
    <!-- Large-file guard: mirror the main site's 5 MiB rule. Browsing a huge
         document in the plugin can freeze the tab, so we link to the site's
         dedicated Large JSON Explorer instead of parsing it on the main thread. -->
    <div v-if="isLargeFile && !largeDismissed" class="je-large-file-warn">
      <span class="je-large-file-ico" v-html="icons.alert" />
      <span class="je-large-file-text">{{ t('largeFileWarning', { size: largeFileSize }) }}</span>
      <button type="button" class="je-btn je-btn-sm je-large-file-go" @click="openLargeFileViewer">
        {{ t('largeFileOpen') }}
      </button>
      <button
        type="button"
        class="je-large-file-x"
        :title="t('largeFileDismiss')"
        :aria-label="t('largeFileDismiss')"
        @click="largeDismissed = true"
      >
        <span v-html="icons.x" />
      </button>
    </div>

    <!-- Single unified toolbar: copy, search, view switch and expand/collapse
         all live here, so the tree pane never renders a second (duplicate)
         toolbar. It never wraps — narrow viewports scroll instead of dropping
         the view switcher onto a second row. -->
    <div class="je-toolbar je-toolbar-main">
        <button type="button" class="je-btn" :title="t('copy')" @click="onCopy">
          <span v-html="copied ? icons.check : icons.copy" />
          <span>{{ copied ? t('copied') : t('copy') }}</span>
        </button>

        <span class="je-sep" />

        <select v-model="searchMode" class="je-mode je-site-select" :aria-label="t('search_mode')">
          <option value="key">{{ t('mode_key') }}</option>
          <option value="value">{{ t('mode_value') }}</option>
          <option value="path">{{ t('mode_path') }}</option>
          <option value="all">{{ t('mode_all') }}</option>
          <option value="jsonpath">{{ t('mode_jsonpath') }}</option>
        </select>

        <span class="je-search">
          <span v-html="icons.search" />
          <input
            ref="searchInput"
            v-model="searchQuery"
            class="je-site-input"
            type="search"
            :placeholder="t('search_placeholder')"
            :aria-label="t('search')"
            @keydown.enter.prevent="onSearchEnter"
            @keydown.esc="clearSearch"
          />
        </span>

        <span v-if="searchResultLabel" class="je-count" :class="{ 'is-error': searchResult.invalid }">
          {{ searchResultLabel }}
        </span>

        <template v-if="searchActive">
          <button
            type="button"
            class="je-btn je-btn-icon je-site-icon"
            :class="{ 'je-btn-active': showResults }"
            :disabled="!searchResult.rows.length"
            :title="t('results')"
            :aria-label="t('results')"
            @click="showResults = !showResults"
          >
            <span v-html="icons.list" />
          </button>
          <button
            type="button"
            class="je-btn je-btn-icon je-site-icon"
            :disabled="!searchResult.rows.length"
            :title="t('previous_match')"
            :aria-label="t('previous_match')"
            @click="onPrevMatch"
          >
            <span v-html="icons.chevronUp" />
          </button>
          <button
            type="button"
            class="je-btn je-btn-icon je-site-icon"
            :disabled="!searchResult.rows.length"
            :title="t('next_match')"
            :aria-label="t('next_match')"
            @click="onNextMatch"
          >
            <span v-html="icons.chevronDown" />
          </button>
        </template>

        <span class="je-toolbar-spacer" />

        <button
          type="button"
          class="je-btn je-btn-icon"
          :disabled="view === 'table'"
          :title="allExpanded ? t('collapse_all') : t('expand_all')"
          @click="onToggleAll"
        >
          <span>{{ allExpanded ? t('collapse_all') : t('expand_all') }}</span>
          <span v-html="allExpanded ? icons.collapse : icons.expand" />
        </button>

        <span class="je-sep" />

        <div class="je-mode-group">
          <button
            v-for="option in allowedViewOptions"
            :key="option"
            type="button"
            class="je-btn"
            :class="{ 'je-btn-active': view === option }"
            @click="view = option"
          >{{ t(option) }}</button>
        </div>
      </div>

      <!-- Outside the toolbar: `overflow-y: hidden` on the single row would
           otherwise clip the floating drawer. -->
      <div v-if="showResults && searchActive && searchResult.rows.length" class="je-results">
        <div class="je-results-head">
          <span>{{ t('results') }} · {{ t('matches', { n: searchResult.truncated ? `${searchResult.total}+` : searchResult.total }) }}</span>
          <button type="button" class="je-btn je-btn-icon je-site-icon" :title="t('close')" :aria-label="t('close')" @click="showResults = false">
            <span v-html="icons.x" />
          </button>
        </div>
        <div class="je-results-list">
          <button
            v-for="(row, i) in searchResult.rows"
            :key="row.path"
            type="button"
            class="je-result"
            :class="{ 'is-current': i === searchResult.currentIndex }"
            @click="onJump(row, i)"
          >
            <span class="je-result-main">
              <span class="je-result-snippet">{{ row.snippet }}</span>
              <span v-if="row.kind" class="je-result-badge">{{ row.kind }}</span>
              <span v-if="row.type" class="je-result-badge">{{ row.type }}</span>
            </span>
            <span class="je-result-path">{{ row.path }}</span>
          </button>
        </div>
      </div>

    <div class="je-body" ref="bodyRef">
      <CodeEditor
        v-if="view === 'editor' || view === 'both'"
        ref="editorRef"
        v-model="text"
        :style="splitStyle"
        :read-only="readOnly"
        :placeholder="placeholder"
        :indent="indentValue"
        :max-bytes="maxBytes"
        :locale="resolvedLocale"
        :messages="resolvedMessages"
        :bordered="false"
        :show-status="false"
        :hover-line="hoverLine"
        @oversized-paste="onOversizedPaste"
        @hover-line="onHoverLine"
        @copied="onEditorCopied"
      />
      <div
        v-if="view === 'both'"
        class="je-splitter"
        role="separator"
        aria-orientation="vertical"
        @mousedown="onSplitDragStart"
      />
      <TreeView
        v-if="view === 'tree' || view === 'both'"
        ref="treeRef"
        class="je-pane"
        v-model:text="text"
        :locale="resolvedLocale"
        :messages="resolvedMessages"
        :indent="indentValue"
        :editable="!readOnly"
        :on-notify="onNotify"
        :image-preview="imagePreview"
        :bare-image="bareImage"
        :show-toolbar="false"
        :search-query="searchQuery"
        :search-mode="searchMode"
        :hovered-path="hoveredPath"
        @search-result="searchResult = $event"
        @update:all-expanded="allExpanded = $event"
        @hover-path="hoveredPath = $event"
        @copied="onTreeCopied"
        @select="onSelect"
      />
      <TableView
        v-if="view === 'table'"
        class="je-pane"
        :value="parsedValue"
        :locale="resolvedLocale"
        :messages="resolvedMessages"
        :on-notify="onNotify"
      />
    </div>

    <div v-if="showStatus" :class="['je-status', errorInfo && 'is-error']">
      <span class="je-dot" :class="{ 'is-error': !!errorInfo }" />
      <span class="je-status-message">{{ statusText }}</span>
      <button
        v-if="errorInfo?.location"
        type="button"
        class="je-status-loc je-jump"
        :title="t('jump_to_error')"
        :aria-label="t('jump_to_error')"
        @click="jumpToError"
      >
        {{ t('line_column', { line: errorInfo.location.line, column: errorInfo.location.column }) }}
      </button>
      <span class="je-status-right">{{ t('chars', { n: text.length }) }}</span>
    </div>

    <div v-if="attribution" class="je-footer">
      <a v-if="attribution" :href="attributionUrl" target="_blank" rel="noopener">{{ t('attribution', { name: 'jsontoolbox.cc' }) }}</a>
    </div>

    <div v-if="showCopiedToast" class="je-toast" role="status" aria-live="polite">
      <span v-html="icons.check" />
      <span>{{ t('copied') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import CodeEditor from './CodeEditor.vue'
import TreeView from './TreeView.vue'
import TableView from './TableView.vue'
import { useTheme, type ThemeOption } from './useTheme'
import { useJsonEditorOptions } from './options'
import { icons } from './icons'
import { copyText } from './clipboard'
import { createTranslator, type Locale, type Messages } from '../i18n'
import { analyzeJson, parseJson, type ErrorLocation } from '../core/parse'
import { LARGE_FILE_MAX_BYTES, byteLength, formatBytes, LARGE_FILE_VIEWER_URL } from '../core/largeFile'
import type { IndentOption } from '../core/format'
import { buildSourceMap } from '../core/sourceMap'
import type { TreeSearchMode, SearchRow, SearchSummary } from '../core/tree'
// The extension inlines `editorCss` into its own shadow root instead of
// injecting styles into the host page's <head>.

export type JsonEditorView = 'editor' | 'tree' | 'both' | 'table'

// `bordered` / `showStatus` need real defaults: Vue casts an absent Boolean
// prop to `false`, so a `?? true` fallback would never kick in.
const props = withDefaults(
  defineProps<{
    modelValue?: string
    view?: JsonEditorView
    theme?: ThemeOption
    locale?: Locale
    messages?: Partial<Messages>
    readOnly?: boolean
    placeholder?: string
    indent?: IndentOption
    maxBytes?: number
    height?: string
    /** Show the outer border and rounded corners. */
    bordered?: boolean
    /** Show the status bar (validity, error location, character count). */
    showStatus?: boolean
    /** Show a small "powered by jsontoolbox.cc" link. Off by default. */
    attribution?: boolean
    attributionUrl?: string
    /** Receive node-edit notifications (errors/success) from the tree view. */
    onNotify?: (message: string, kind: 'error' | 'success') => void
    /** Show remote image previews (default ON). Local base64/data-URI images always render. */
    imagePreview?: boolean
    /** Render image values as just the <img> with no surrounding label. */
    bareImage?: boolean
    /** Restrict which view-mode buttons are shown. Default: all four (editor/tree/both/table). */
    allowedViews?: JsonEditorView[]
    /** Render the search box in the single top toolbar instead of inside the tree. */
    searchInToolbar?: boolean
    /** Sync the scroll position between the editor and tree panes in Split view. */
    linkScroll?: boolean
    /** Ko-fi (or any "support the project") URL shown in the footer. Empty string hides it. */
    koFiUrl?: string
  }>(),
  { bordered: true, showStatus: true, searchInToolbar: false, bareImage: false, linkScroll: false, koFiUrl: 'https://ko-fi.com' }
)

// Resolution order for every optional prop: explicit prop → plugin defaults
// (`app.use(JsonEditorPlugin, {...})`) → built-in default.
const pluginOptions = useJsonEditorOptions()
const resolvedLocale = computed<Locale>(() => props.locale ?? pluginOptions?.locale ?? 'en')
const resolvedTheme = computed<ThemeOption>(() => props.theme ?? pluginOptions?.theme ?? 'auto')
const resolvedIndent = computed<IndentOption>(() => props.indent ?? pluginOptions?.indent ?? 2)
const resolvedMessages = computed(() => props.messages ?? pluginOptions?.messages)
const resolvedHeight = computed(() => props.height ?? pluginOptions?.height ?? '420px')
const readOnly = computed(() => props.readOnly ?? false)
const maxBytes = computed(() => props.maxBytes ?? 0)

// Mirror the main site's 5 MiB rule: above this, browsing in the plugin can
// freeze the tab, so we surface a banner that links to the site's dedicated
// Large JSON Explorer instead of parsing the document on the main thread.
const docBytes = computed(() => byteLength(text.value ?? ''))
const isLargeFile = computed(() => docBytes.value > LARGE_FILE_MAX_BYTES)
const largeFileSize = computed(() => formatBytes(docBytes.value))
const largeDismissed = ref(false)
function openLargeFileViewer() {
  window.open(LARGE_FILE_VIEWER_URL, '_blank', 'noopener')
}
const placeholder = computed(() => props.placeholder ?? '')
const bordered = computed(() => props.bordered)
const showStatus = computed(() => props.showStatus)
const attribution = computed(() => props.attribution ?? false)
const attributionUrl = computed(() => props.attributionUrl ?? 'https://jsontoolbox.cc')
const supportUrl = computed(() => props.koFiUrl ?? '')

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:view': [view: JsonEditorView]
  error: [info: { message: string; location: ErrorLocation | null } | null]
  select: [info: { path: string; jsonPath: string; value: unknown }]
  'oversized-paste': [info: { bytes: number; text: string }]
}>()

const text = ref(props.modelValue ?? '')
watch(
  () => props.modelValue,
  (value) => {
    if (value != null && value !== text.value) text.value = value
  }
)
watch(text, (value) => emit('update:modelValue', value))

const view = ref<JsonEditorView>(props.view ?? 'both')
watch(
  () => props.view,
  (value) => {
    if (value) view.value = value
  }
)
watch(view, (value) => emit('update:view', value))

// ── Tree ↔ source hover linking (only meaningful in Split view) ────────────
// `buildSourceMap` scans the current text (what CodeEditor actually shows) and
// maps each tree path to its 1-based source line, so hovering one pane can
// highlight the matching row in the other. The reverse lookup keeps a sorted
// line array for O(log n) binary search on large documents.
const sourceMap = computed<Map<string, number>>(() => {
  if (view.value !== 'both') return new Map()
  try {
    return buildSourceMap(text.value ?? '')
  } catch {
    return new Map()
  }
})
const sourceLines = computed<{ line: number; path: string }[]>(() => {
  const arr = [...sourceMap.value.entries()].map(([path, line]) => ({ line, path }))
  arr.sort((a, b) => a.line - b.line)
  return arr
})
const hoveredPath = ref<string | null>(null)
const hoverLine = computed<number | null>(() => {
  const p = hoveredPath.value
  if (!p) return null
  const l = sourceMap.value.get(p)
  return l != null ? l : null
})
function lineToPath(line: number): string | null {
  const arr = sourceLines.value
  let lo = 0
  let hi = arr.length - 1
  let ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (arr[mid].line <= line) {
      ans = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return ans >= 0 ? arr[ans].path : null
}
function onHoverLine(line: number | null) {
  hoveredPath.value = line == null ? null : lineToPath(line)
}
// Leaving Split view drops any stale highlight.
watch(view, (v) => {
  if (v !== 'both') hoveredPath.value = null
})

const indentValue = ref<IndentOption>(resolvedIndent.value)
watch(resolvedIndent, (value) => {
  indentValue.value = value
})

const { isDark } = useTheme(resolvedTheme)
const t = computed(() => createTranslator(resolvedLocale.value, resolvedMessages.value))

const editorRef = ref<InstanceType<typeof CodeEditor> | null>(null)
const bodyRef = ref<HTMLElement | null>(null)
const allowedViewOptions = computed<JsonEditorView[]>(
  () => props.allowedViews ?? ['editor', 'tree', 'both', 'table']
)
const searchQuery = ref('')
const searchInput = ref<HTMLInputElement | null>(null)
const searchMode = ref<TreeSearchMode>('key')

// Tree state is mirrored up here because the plugin renders the tree's
// expand/collapse control, match count and search navigation in one toolbar.
const treeRef = ref<InstanceType<typeof TreeView> | null>(null)
const allExpanded = ref(true)
const searchResult = ref<SearchSummary>({
  total: 0, invalid: false, truncated: false, currentIndex: -1, rows: [],
})
const showResults = ref(false)
const searchActive = computed(
  () => view.value !== 'table' && searchQuery.value.trim().length > 0
)
watch(searchQuery, (value) => { if (!value.trim()) showResults.value = false })

const searchResultLabel = computed(() => {
  if (!searchActive.value) return ''
  if (searchResult.value.invalid) return t.value('invalid_expression')
  if (!searchResult.value.rows.length) return t.value('no_matches')
  const position = `${searchResult.value.currentIndex + 1}/${searchResult.value.total}`
  return searchResult.value.truncated ? `${position}+` : position
})
function onToggleAll() {
  treeRef.value?.toggleAll()
}
function onNextMatch() {
  treeRef.value?.nextMatch()
}
function onPrevMatch() {
  treeRef.value?.prevMatch()
}
function onJump(row: SearchRow, index: number) {
  treeRef.value?.jumpTo(row.path, index)
  showResults.value = false
}
function onSearchEnter(e: KeyboardEvent) {
  if (e.shiftKey) onPrevMatch()
  else onNextMatch()
}
function clearSearch() {
  searchQuery.value = ''
  showResults.value = false
}

// Intercept Ctrl/Cmd+F while the preview (tree) UI is visible: the page is
// covered by a full-screen overlay, so the browser's native find bar is useless
// here. Focus our in-toolbar search box instead. In raw mode the editor is
// display:none (getClientRects empty), so we let the browser find work.
function onFindShortcut(e: KeyboardEvent) {
  if (!(e.ctrlKey || e.metaKey)) return
  if (e.key !== 'f' && e.key !== 'F') return
  const input = searchInput.value
  if (!input || input.getClientRects().length === 0) return
  e.preventDefault()
  input.focus()
  input.select()
}

// ── Split-view scroll sync (opt-in via `linkScroll`) ──────────────────────────
let scrollCleanup: (() => void) | null = null
function syncScroll(src: HTMLElement, dst: HTMLElement) {
  const sMax = src.scrollHeight - src.clientHeight
  const dMax = dst.scrollHeight - dst.clientHeight
  if (sMax <= 0 || dMax <= 0) return
  dst.scrollTop = (src.scrollTop / sMax) * dMax
}
function setupScrollSync() {
  scrollCleanup?.()
  scrollCleanup = null
  if (!props.linkScroll || view.value !== 'both') return
  let tries = 0
  const tryBind = () => {
    const body = bodyRef.value
    if (!body) return
    const left = body.querySelector<HTMLElement>('.je-editor .cm-scroller')
    const right = body.querySelector<HTMLElement>('.je-tree')
    // CodeMirror (and the tree) may not be mounted yet in the injected shadow
    // world — retry on the next frame instead of silently giving up.
    if ((!left || !right) && tries < 30) {
      tries++
      requestAnimationFrame(tryBind)
      return
    }
    if (!left || !right) return
    let syncing = false
    const onLeft = () => {
      if (syncing) return
      syncing = true
      syncScroll(left, right)
      requestAnimationFrame(() => (syncing = false))
    }
    const onRight = () => {
      if (syncing) return
      syncing = true
      syncScroll(right, left)
      requestAnimationFrame(() => (syncing = false))
    }
    left.addEventListener('scroll', onLeft)
    right.addEventListener('scroll', onRight)
    scrollCleanup = () => {
      left.removeEventListener('scroll', onLeft)
      right.removeEventListener('scroll', onRight)
    }
  }
  nextTick(tryBind)
}
watch([view, () => props.linkScroll], setupScrollSync)
onMounted(setupScrollSync)
onBeforeUnmount(() => scrollCleanup?.())
onMounted(() => window.addEventListener('keydown', onFindShortcut))
onBeforeUnmount(() => window.removeEventListener('keydown', onFindShortcut))

const hasContent = computed(() => text.value.trim().length > 0)
const errorInfo = computed(() => {
  if (!hasContent.value) return null
  const { error, location } = analyzeJson(text.value)
  return error ? { message: error, location } : null
})
watch(errorInfo, (info) => emit('error', info), { immediate: true })

const statusText = computed(() => {
  if (!hasContent.value) return t.value('empty')
  return errorInfo.value ? `${t.value('invalid')} — ${errorInfo.value.message}` : t.value('valid')
})

/** Parsed JSON passed to the table view. `null` when empty or invalid. */
const parsedValue = computed<unknown>(() => {
  if (!hasContent.value) return null
  const r = parseJson(text.value)
  return r.error ? null : r.data
})

async function jumpToError() {
  const location = errorInfo.value?.location
  if (!location) return
  // The editor is not mounted in tree/table-only mode, so reveal it first.
  if (view.value === 'tree' || view.value === 'table') view.value = 'editor'
  await nextTick()
  editorRef.value?.scrollToLine(location.line)
  editorRef.value?.flashLines(location.line)
}

function onOversizedPaste(info: { bytes: number; text: string }) {
  emit('oversized-paste', info)
}

function onSelect(info: { path: string; jsonPath: string; value: unknown }) {
  emit('select', info)
}

function onFormat() {
  editorRef.value?.format()
}

function onMinify() {
  editorRef.value?.minify()
}

const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | null = null

// Lightweight toast for copy actions (selection copy in the editor + the Copy
// button). Independent of the host-supplied `onNotify`, so the feedback always
// shows even when the host does not provide a notification channel.
const showCopiedToast = ref(false)
let copiedToastTimer: ReturnType<typeof setTimeout> | null = null
function flashCopiedToast() {
  showCopiedToast.value = true
  if (copiedToastTimer) clearTimeout(copiedToastTimer)
  copiedToastTimer = setTimeout(() => {
    showCopiedToast.value = false
  }, 1600)
}
function onEditorCopied(_text: string) {
  flashCopiedToast()
}

// ── Split-view draggable divider ───────────────────────────────────────────
const splitRatio = ref(0.5)
const splitStyle = computed(() =>
  view.value === 'both' ? { flex: `0 0 ${(splitRatio.value * 100).toFixed(2)}%` } : undefined
)
let splitDragging = false
function onSplitDragStart(e: MouseEvent) {
  if (view.value !== 'both') return
  splitDragging = true
  bodyRef.value?.classList.add('is-splitting')
  window.addEventListener('mousemove', onSplitDragMove)
  window.addEventListener('mouseup', onSplitDragEnd)
  e.preventDefault()
}
function onSplitDragMove(e: MouseEvent) {
  if (!splitDragging) return
  const body = bodyRef.value
  if (!body) return
  const rect = body.getBoundingClientRect()
  const dividerW = 6
  let ratio = (e.clientX - rect.left) / (rect.width - dividerW)
  ratio = Math.min(0.8, Math.max(0.2, ratio))
  splitRatio.value = ratio
}
function onSplitDragEnd() {
  if (!splitDragging) return
  splitDragging = false
  bodyRef.value?.classList.remove('is-splitting')
  window.removeEventListener('mousemove', onSplitDragMove)
  window.removeEventListener('mouseup', onSplitDragEnd)
}
onBeforeUnmount(onSplitDragEnd)

function onTreeCopied(_info: { kind: 'path' | 'jsonPath' | 'value'; text: string }) {
  flashCopiedToast()
}

async function onCopy() {
  const ok = await copyText(text.value)
  if (!ok) return
  copied.value = true
  flashCopiedToast()
  if (copiedTimer) clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => {
    copied.value = false
  }, 1200)
}

defineExpose({
  format: onFormat,
  minify: onMinify,
  focus: () => editorRef.value?.focus(),
  scrollToLine: (line: number) => editorRef.value?.scrollToLine(line),
  flashLines: (from: number, to?: number) => editorRef.value?.flashLines(from, to),
})
</script>
