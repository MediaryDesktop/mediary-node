/**
 * Which languages exist and where the choice is remembered.
 *
 * Adding a language is three steps: a locale file next to `en.ts`, an entry in
 * `LANGUAGES`, and a `language.<code>` phrase in every locale — the compiler
 * points at the last two if you forget.
 */

export const LANGUAGES = ['en', 'uk', 'ru'] as const

export type Language = (typeof LANGUAGES)[number]

/**
 * English, not the OS locale.
 *
 * Detecting the system language is one line (`navigator.language`), but it was
 * left out on purpose: the app is authored in English first, and a translation
 * that falls behind should be a visible choice rather than the default a user
 * silently lands in.
 */
export const DEFAULT_LANGUAGE: Language = 'en'

const STORAGE_KEY = 'mediary.language'

export function isLanguage(value: unknown): value is Language {
	return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value)
}

/**
 * The stored choice, if there is a usable one.
 *
 * Wrapped in try/catch because storage is not guaranteed: a packaged renderer
 * with site data disabled throws on access rather than returning null, and a
 * missing preference must never keep the window from opening.
 */
export function readStoredLanguage(): Language | null {
	try {
		const stored = window.localStorage.getItem(STORAGE_KEY)

		return isLanguage(stored) ? stored : null
	} catch {
		return null
	}
}

export function storeLanguage(language: Language): void {
	try {
		window.localStorage.setItem(STORAGE_KEY, language)
	} catch {
		// A preference that cannot be saved is worth less than a crash costs.
	}
}
