import { DEFAULT_THEME, isTheme, readStoredTheme, storeTheme } from '../config/config'
import type { Theme } from '../config/config'

const listeners = new Set<() => void>()

let current: Theme = readStoredTheme() ?? DEFAULT_THEME

let pinned: Theme | null = null
let holders = 0

function paint(): void {
	document.documentElement.dataset.theme = pinned ?? current
}

function notify(): void {
	for (const listener of listeners) {
		listener()
	}
}

export function getTheme(): Theme {
	return current
}

export function getSurfaceTheme(): Theme {
	return pinned ?? current
}

export function setTheme(theme: Theme): void {
	if (!isTheme(theme) || theme === current) {
		return
	}

	current = theme
	storeTheme(theme)
	paint()
	notify()
}

export function pinTheme(theme: Theme): () => void {
	if (!isTheme(theme)) {
		return () => {}
	}

	holders += 1
	pinned = theme
	paint()
	notify()

	let released = false

	return () => {
		if (released) {
			return
		}

		released = true
		holders -= 1

		if (holders > 0) {
			return
		}

		pinned = null
		paint()
		notify()
	}
}

export function subscribeTheme(listener: () => void): () => void {
	listeners.add(listener)

	return () => {
		listeners.delete(listener)
	}
}

paint()
