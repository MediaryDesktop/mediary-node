import { readStored, writeStored } from '../lib/storage/storage'

export const LANGUAGES = ['en', 'uk', 'ru'] as const

export type Language = (typeof LANGUAGES)[number]

export const DEFAULT_LANGUAGE: Language = 'en'

const STORAGE_KEY = 'mediary.language'

export function isLanguage(value: unknown): value is Language {
	return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value)
}

export function readStoredLanguage(): Language | null {
	const stored = readStored(STORAGE_KEY)

	return isLanguage(stored) ? stored : null
}

export function storeLanguage(language: Language): void {
	writeStored(STORAGE_KEY, language)
}
