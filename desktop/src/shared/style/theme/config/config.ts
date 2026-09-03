export const THEMES = ['dark', 'light'] as const

export type Theme = (typeof THEMES)[number]

export const DEFAULT_THEME: Theme = 'dark'

const STORAGE_KEY = 'mediary.theme'

export function isTheme(value: unknown): value is Theme {
	return typeof value === 'string' && (THEMES as readonly string[]).includes(value)
}

export function readStoredTheme(): Theme | null {
	try {
		const stored = window.localStorage.getItem(STORAGE_KEY)

		return isTheme(stored) ? stored : null
	} catch {
		return null
	}
}

export function storeTheme(theme: Theme): void {
	try {
		window.localStorage.setItem(STORAGE_KEY, theme)
	} catch {}
}
