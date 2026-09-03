const STORAGE_KEY = 'mediary.lastAuthProvider'

export function readLastProvider(): string | null {
	try {
		return window.localStorage.getItem(STORAGE_KEY)
	} catch {
		return null
	}
}

export function storeLastProvider(provider: string): void {
	try {
		window.localStorage.setItem(STORAGE_KEY, provider)
	} catch {}
}
