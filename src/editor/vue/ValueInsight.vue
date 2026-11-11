<template>
  <span v-if="insight" ref="hostEl" class="je-insight" :class="'is-' + insight.kind">
    <!-- The row already shows the raw value; the insight only adds what the
         raw text cannot (a swatch, a decoded date, a thumbnail, an action). -->
    <template v-if="insight.kind === 'color'">
      <span class="je-swatch" :style="{ background: insight.css }" :title="insight.value" />
    </template>

    <template v-else-if="insight.kind === 'timestamp'">
      <span class="je-insight-val">{{ insight.views.local }}</span>
      <span class="je-insight-sub">{{ insight.views.utc }}</span>
    </template>

    <template v-else-if="insight.kind === 'jwt'">
      <button type="button" class="je-btn je-btn-sm" @click="open = !open">
        {{ t('insight_jwt') }}
      </button>
      <pre v-if="open" class="je-insight-pre">{{ pretty(insight.payload) }}</pre>
    </template>

    <template v-else-if="insight.kind === 'base64'">
      <img
        v-if="insight.image && insight.dataUrl && !imageFailed"
        class="je-insight-img"
        :class="bareImage && 'je-insight-img-bare'"
        :src="insight.dataUrl"
        alt=""
        @error="imageFailed = true"
        @click.stop="openPreview(insight.dataUrl ?? '')"
      />
      <template v-else>
        <span class="je-insight-val">{{ t('insight_base64') }} · {{ t('bytes', { n: insight.bytes }) }}</span>
        <span class="je-insight-sub">{{ truncate(insight.text || '') }}</span>
      </template>
    </template>

    <template v-else-if="insight.kind === 'image'">
      <img
        v-if="imagePreview && !imageFailed"
        class="je-insight-img"
        :class="bareImage && 'je-insight-img-bare'"
        :src="insight.url"
        alt=""
        loading="lazy"
        @error="imageFailed = true"
        @click.stop="openPreview(insight.url)"
      />
      <a
        v-else
        :href="insight.url"
        target="_blank"
        rel="noopener noreferrer"
        class="je-insight-icon"
        :title="insight.url"
        :aria-label="insight.url"
      ><span v-html="icons.external" /></a>
    </template>

    <template v-else-if="insight.kind === 'audio' || insight.kind === 'video' || insight.kind === 'pdf'">
      <span class="je-insight-val">{{ t('insight_' + insight.kind) }}</span>
      <button v-if="!mediaLoaded" type="button" class="je-btn je-btn-sm" @click="mediaLoaded = true">
        {{ t('media_load_preview') }}
      </button>
      <audio v-else-if="insight.kind === 'audio'" :src="insight.url" controls preload="none" class="je-insight-media" />
      <video v-else-if="insight.kind === 'video'" :src="insight.url" controls preload="none" class="je-insight-media" />
      <iframe v-else :src="insight.url" class="je-insight-media" :title="t('insight_pdf')" />
    </template>

    <template v-else-if="insight.kind === 'url'">
      <!-- Try every short http(s) value as an image (covers extension-less
           CDN / image-service URLs); on error keep just an icon link. -->
      <img
        v-if="imagePreview && isImageCandidate(insight.url) && !imageFailed"
        class="je-insight-img"
        :class="bareImage && 'je-insight-img-bare'"
        :src="insight.url"
        alt=""
        loading="lazy"
        @error="imageFailed = true"
        @click.stop="openPreview(insight.url)"
      />
      <a
        v-else
        :href="insight.url"
        target="_blank"
        rel="noopener noreferrer"
        class="je-insight-icon"
        :title="insight.url"
        :aria-label="insight.url"
      ><span v-html="icons.external" /></a>
    </template>

    <template v-else-if="insight.kind === 'email'">
      <a
        :href="'mailto:' + insight.value"
        class="je-insight-icon"
        :title="insight.value"
        :aria-label="insight.value"
      ><span v-html="icons.mail" /></a>
    </template>

    <template v-else-if="insight.kind === 'uuid' || insight.kind === 'ip' || insight.kind === 'regex'">
      <span class="je-insight-val je-mono">{{ t('insight_' + insight.kind) }}</span>
    </template>

    <template v-else-if="insight.kind === 'markdown'">
      <span class="je-insight-val">{{ t('insight_markdown') }}</span>
    </template>
  </span>

  <!-- Lightbox: click the backdrop / press Esc to close, arrows to step through
       every image currently rendered in the tree (same flow as the site's
       PhotoSwipe preview, without pulling in a library). -->
  <div v-if="zoomSrc" class="je-lightbox" @click="closePreview">
    <div class="je-lightbox-bar" @click.stop>
      <span>{{ zoomIndex + 1 }} / {{ zoomList.length }}</span>
      <button
        type="button"
        class="je-btn je-lightbox-dlall"
        :title="t('download_all')"
        :aria-label="t('download_all')"
        :disabled="downloadingAll"
        @click.stop="downloadAllImages"
      >
        <span v-html="icons.download" />
        <span>{{ t('download_all') }}</span>
      </button>
      <a
        class="je-btn je-btn-icon"
        :href="zoomSrc"
        download
        target="_blank"
        rel="noopener noreferrer"
        :title="t('download')"
        :aria-label="t('download')"
        @click.stop
      >
        <span v-html="icons.download" />
      </a>
      <button
        type="button"
        class="je-btn je-btn-icon"
        :title="t('close')"
        :aria-label="t('close')"
        @click="closePreview"
      >
        <span v-html="icons.x" />
      </button>
    </div>
    <button
      v-if="zoomList.length > 1"
      type="button"
      class="je-lightbox-arrow is-prev"
      :title="t('previous_image')"
      @click.stop="stepPreview(-1)"
    >
      <span v-html="icons.chevronLeft" />
    </button>
    <img :src="zoomSrc" alt="" @click.stop />
    <button
      v-if="zoomList.length > 1"
      type="button"
      class="je-lightbox-arrow is-next"
      :title="t('next_image')"
      @click.stop="stepPreview(1)"
    >
      <span v-html="icons.chevronRight" />
    </button>
    <div v-if="zoomList.length > 1" class="je-lightbox-thumbs" @click.stop>
      <button
        v-for="(url, i) in thumbList"
        :key="url"
        type="button"
        class="je-lightbox-thumb"
        :class="{ 'is-active': i === zoomIndex }"
        @click="zoomIndex = i"
      >
        <img :src="url" alt="" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { inspectValue, type ValueInsight as ValueInsightResult } from '../core/valueInspector'
import { createTranslator, type Locale, type Messages, type MessageKey } from '../i18n'
import { icons } from './icons'

const props = withDefaults(
  defineProps<{
    value: unknown
    locale?: Locale
    messages?: Partial<Messages>
    /** Show remote image/URL previews (default ON). Local base64/data-URI images always render. */
    imagePreview?: boolean
    /** Render image values as just the <img> with no surrounding label (default OFF). */
    bareImage?: boolean
  }>(),
  { locale: 'en', imagePreview: true, bareImage: false }
)

// Dynamic `insight_<kind>` keys are built from the recognized value kind, so
// widen the key type here while keeping the dictionary lookup typed inside.
const t = computed(() => {
  const translate = createTranslator(props.locale, props.messages)
  return (key: string, params?: Record<string, string | number>): string =>
    translate(key as MessageKey, params)
})
const open = ref(false)
const mediaLoaded = ref(false)
const imageFailed = ref(false)

const hostEl = ref<HTMLElement | null>(null)
const zoomList = ref<string[]>([])
const zoomIndex = ref(0)
const zoomSrc = computed(() => zoomList.value[zoomIndex.value] ?? '')

const insight = computed<ValueInsightResult | null>(() => inspectValue(props.value))
const thumbList = computed(() => zoomList.value.slice(0, 30))

/** The site's rule: any reasonably short http(s) value may be an image. The
 *  `<img>` error handler hides the ones that are not (no extension needed). */
function isImageCandidate(url: string): boolean {
  return /^https?:\/\//i.test(url) && url.length <= 2048
}

function openPreview(src: string) {
  const root = hostEl.value?.getRootNode() as ParentNode | null
  const urls = root
    ? Array.from(root.querySelectorAll<HTMLImageElement>('.je-insight-img'))
        .map((el) => el.currentSrc || el.src)
        .filter(Boolean)
    : []
  const unique = [...new Set(urls)]
  if (!unique.includes(src)) unique.unshift(src)
  zoomList.value = unique.length ? unique : [src]
  zoomIndex.value = Math.max(0, zoomList.value.indexOf(src))
  document.addEventListener('keydown', onPreviewKey)
}

function closePreview() {
  zoomList.value = []
  zoomIndex.value = 0
  document.removeEventListener('keydown', onPreviewKey)
}

// Download every image currently in the lightbox (one per node thumbnail).
const downloadingAll = ref(false)
function filenameFromUrl(url: string, i: number): string {
  if (url.startsWith('data:')) {
    const m = /^data:([^;]+)/.exec(url)
    const ext = (m && m[1].split('/')[1]) || 'img'
    return `image-${i + 1}.${ext}`
  }
  const base = url.split('?')[0].split('/').pop() || `image-${i + 1}`
  return /\.[a-z0-9]+$/i.test(base) ? base : `${base}.jpg`
}
function triggerDownload(href: string, name: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
async function downloadAllImages() {
  if (downloadingAll.value) return
  downloadingAll.value = true
  const list = zoomList.value
  try {
    for (let i = 0; i < list.length; i++) {
      const url = list[i]
      const name = filenameFromUrl(url, i)
      try {
        if (!url.startsWith('data:')) {
          const res = await fetch(url)
          if (res.ok) {
            const blob = await res.blob()
            const objUrl = URL.createObjectURL(blob)
            triggerDownload(objUrl, name)
            setTimeout(() => URL.revokeObjectURL(objUrl), 1500)
          } else {
            triggerDownload(url, name)
          }
        } else {
          triggerDownload(url, name)
        }
      } catch {
        // Cross-origin fetch may fail; fall back to the raw URL (browser may
        // open it in a new tab instead of saving).
        triggerDownload(url, name)
      }
      // Small gap so the browser does not batch-block multiple downloads.
      await new Promise((r) => setTimeout(r, 250))
    }
  } finally {
    downloadingAll.value = false
  }
}

function stepPreview(delta: number) {
  if (zoomList.value.length < 2) return
  zoomIndex.value = (zoomIndex.value + delta + zoomList.value.length) % zoomList.value.length
}

function onPreviewKey(e: KeyboardEvent) {
  if (e.key === 'Escape') closePreview()
  else if (e.key === 'ArrowLeft') stepPreview(-1)
  else if (e.key === 'ArrowRight') stepPreview(1)
}
onBeforeUnmount(() => document.removeEventListener('keydown', onPreviewKey))

function pretty(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function truncate(value: string, max = 120): string {
  return value.length > max ? value.slice(0, max) + '…' : value
}
</script>
