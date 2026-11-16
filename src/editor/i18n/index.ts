import { en, type MessageKey, type Messages } from './en'
import { zh } from './zh'
import { ja } from './ja'
import { fr } from './fr'
import { es } from './es'
import { de } from './de'

export * from './en'
export { zh, ja, fr, es, de }

export type Locale = 'en' | 'zh' | 'ja' | 'fr' | 'es' | 'de'

const dictionaries: Record<Locale, Messages> = { en, zh, ja, fr, es, de }

export const defaultLocale: Locale = 'en'

export function getDictionary(locale: Locale): Messages {
  return dictionaries[locale] ?? en
}

/**
 * Create a translator.
 *
 * Lookup order: caller overrides → locale dictionary → English.
 * English is the guaranteed fallback, so a partially translated locale can
 * never render an empty string.
 */
export function createTranslator(locale: Locale, overrides?: Partial<Messages>) {
  const dict = getDictionary(locale)
  return function t(key: MessageKey, params?: Record<string, string | number>): string {
    const template = overrides?.[key] ?? dict[key] ?? en[key]
    if (!params) return template
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in params ? String(params[name]) : match
    )
  }
}

export type Translator = ReturnType<typeof createTranslator>
