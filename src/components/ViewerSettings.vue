<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { createTranslator, type Locale } from '../editor/i18n'
import {
  getOptions,
  setOptions,
  type AppLocale,
  type EditorView,
  type ExtensionOptions,
  type IndentOption,
  type ThemeOption,
} from '../../utils/options'
import settingsCss from './ViewerSettings.css?inline'
import { injectStylesIntoRoot } from '../../utils/injectShadowStyles'

const props = withDefaults(
  defineProps<{
    /** Active locale; also drives this panel's own copy. */
    locale: AppLocale
    /** Hide the auto-beautify toggle (used inside the page overlay, where
     *  turning it off would destroy the overlay itself). */
    hideAuto?: boolean
    /** Destination for the "visit site" link in the footer. */
    siteUrl?: string
  }>(),
  { hideAuto: false, siteUrl: 'https://jsontoolbox.cc' },
)

const emit = defineEmits<{ close: [] }>()

// The panel relabels itself the moment the user changes the language, before the
// host has round-tripped the new locale through storage.
const tLocale = ref<AppLocale>(props.locale)
const t = computed(() => createTranslator(tLocale.value as Locale))

const theme = ref<ThemeOption>('auto')
const indent = ref<IndentOption>(2)
const view = ref<EditorView>('both')
const language = ref<AppLocale>('en')
const imagePreview = ref(true)
const auto = ref(true)

function persist(patch: Partial<ExtensionOptions>): void {
  void setOptions(patch)
}

function onTheme(e: Event) {
  theme.value = (e.target as HTMLSelectElement).value as ThemeOption
  persist({ theme: theme.value })
}
function onIndent(e: Event) {
  indent.value = (e.target as HTMLSelectElement).value as IndentOption
  persist({ indent: indent.value })
}
function onView(e: Event) {
  view.value = (e.target as HTMLSelectElement).value as EditorView
  persist({ view: view.value })
}
function onLanguage(e: Event) {
  language.value = (e.target as HTMLSelectElement).value as AppLocale
  tLocale.value = language.value
  persist({ locale: language.value })
}
function onImagePreview(e: Event) {
  imagePreview.value = (e.target as HTMLInputElement).checked
  persist({ imagePreview: imagePreview.value })
}
function onAuto(e: Event) {
  auto.value = (e.target as HTMLInputElement).checked
  persist({ auto: auto.value })
}

const rootEl = ref<HTMLElement | null>(null)

onMounted(async () => {
  // Inject this panel's CSS into whichever root it lives in (shadow root for the
  // overlay / lastPreview viewer, or document.head for a light-DOM mount). Like
  // ViewerShell, it must NOT use `<style scoped>`, which would land in head and
  // fail to pierce the shadow boundary.
  const rootNode = rootEl.value?.getRootNode()
  if (rootNode) injectStylesIntoRoot(rootNode, 'viewer-settings', settingsCss)

  const o = await getOptions()
  theme.value = o.theme
  indent.value = o.indent
  view.value = o.view
  language.value = o.locale
  imagePreview.value = o.imagePreview
  auto.value = o.auto
})
</script>

<template>
  <div class="vs" ref="rootEl">
    <div class="vs-head">
      <span class="vs-title">{{ t('settings') }}</span>
      <button class="vs-close" type="button" :aria-label="t('close')" @click="emit('close')">
        ×
      </button>
    </div>

    <div class="vs-list">
      <div class="vs-row">
        <span class="vs-label">{{ t('theme') }}</span>
        <select :value="theme" @change="onTheme">
          <option value="light">{{ t('theme_light') }}</option>
          <option value="dark">{{ t('theme_dark') }}</option>
          <option value="auto">{{ t('theme_auto') }}</option>
        </select>
      </div>

      <div class="vs-row">
        <span class="vs-label">{{ t('indent') }}</span>
        <select :value="indent" @change="onIndent">
          <option value="2">{{ t('indent_2') }}</option>
          <option value="4">{{ t('indent_4') }}</option>
          <option value="tab">{{ t('indent_tab') }}</option>
        </select>
      </div>

      <div class="vs-row">
        <span class="vs-label">{{ t('default_view') }}</span>
        <select :value="view" @change="onView">
          <option value="editor">{{ t('editor') }}</option>
          <option value="tree">{{ t('tree') }}</option>
          <option value="both">{{ t('both') }}</option>
          <option value="table">{{ t('table') }}</option>
        </select>
      </div>

      <div class="vs-row">
        <span class="vs-label">{{ t('language') }}</span>
        <select :value="language" @change="onLanguage">
          <option value="en">English</option>
          <option value="zh">中文</option>
        </select>
      </div>

      <div class="vs-row">
        <span class="vs-label">{{ t('image_preview') }}</span>
        <input type="checkbox" :checked="imagePreview" @change="onImagePreview" />
      </div>

      <div class="vs-row" v-if="!hideAuto">
        <span class="vs-label">{{ t('auto_beautify') }}</span>
        <input type="checkbox" :checked="auto" @change="onAuto" />
      </div>
    </div>

    <div class="vs-footer">
      <p class="vs-privacy">{{ t('privacy') }}</p>
      <a class="vs-site" :href="siteUrl" target="_blank" rel="noopener">
        {{ t('visit_site') }} ↗
      </a>
    </div>
  </div>
</template>
