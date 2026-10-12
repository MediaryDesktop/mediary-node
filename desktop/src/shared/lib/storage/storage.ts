// Per-computer preferences in localStorage. A window that keeps nothing (storage
// disabled or full) still works: reads come back empty and writes are dropped, so
// a choice simply lasts the session.

export function readStored(key: string): string | null {
	try {
		return window.localStorage.getItem(key)
	} catch {
		return null
	}
}

export function writeStored(key: string, value: string): void {
	try {
		window.localStorage.setItem(key, value)
	} catch {}
}
