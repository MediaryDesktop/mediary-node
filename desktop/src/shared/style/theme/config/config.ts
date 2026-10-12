import { readStored, writeStored } from '../../../lib/storage'

export const THEMES = ['dark', 'light'] as const

export type Theme = (typeof THEMES)[number]

export const DEFAULT_THEME: Theme = 'dark'

const STORAGE_KEY = 'mediary.theme'

export function isTheme(value: unknown): value is Theme {
	return typeof value === 'string' && (THEMES as readonly string[]).includes(value)
}

export function readStoredTheme(): Theme | null {
	const stored = readStored(STORAGE_KEY)

	return isTheme(stored) ? stored : null
}

export function storeTheme(theme: Theme): void {
	writeStored(STORAGE_KEY, theme)
}
