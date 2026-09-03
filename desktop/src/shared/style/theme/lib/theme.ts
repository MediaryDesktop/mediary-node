import { DEFAULT_THEME, isTheme, readStoredTheme, storeTheme } from '../config/config'
import type { Theme } from '../config/config'

const listeners = new Set<() => void>()

let current: Theme = readStoredTheme() ?? DEFAULT_THEME

function paint(theme: Theme): void {
	document.documentElement.dataset.theme = theme
}

export function getTheme(): Theme {
	return current
}

export function setTheme(theme: Theme): void {
	if (!isTheme(theme) || theme === current) {
		return
	}

	current = theme
	paint(theme)
	storeTheme(theme)

	for (const listener of listeners) {
		listener()
	}
}

export function subscribeTheme(listener: () => void): () => void {
	listeners.add(listener)

	return () => {
		listeners.delete(listener)
	}
}

paint(current)
