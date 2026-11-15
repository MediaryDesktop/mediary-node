import type { PipIntent, PipOpenOptions, PipSnapshot } from '../shared/pip.js'

const DEFAULT_ASPECT = 16 / 9

const INTENTS: readonly PipIntent[] = ['mini', 'expand', 'stop']

// What crosses the IPC boundary is untrusted until it has been looked at.

export function parseSnapshot(value: unknown): PipSnapshot | null {
	if (typeof value !== 'object' || value === null) {
		return null
	}

	const { position, playing } = value as Record<string, unknown>

	if (typeof position !== 'number' || !Number.isFinite(position) || position < 0) {
		return null
	}

	return { position, playing: playing === true }
}

export function parseOpenOptions(value: unknown): PipOpenOptions | null {
	const snapshot = parseSnapshot(value)
	const { fileId, aspect } = (value ?? {}) as Record<string, unknown>

	if (!snapshot || typeof fileId !== 'number' || !Number.isInteger(fileId) || fileId <= 0) {
		return null
	}

	// A picture of no sensible shape is shown as a film would be.
	const usable = typeof aspect === 'number' && Number.isFinite(aspect) && aspect >= 0.25 && aspect <= 4

	return { ...snapshot, fileId, aspect: usable ? aspect : DEFAULT_ASPECT }
}

export function parseIntent(value: unknown): PipIntent | null {
	return INTENTS.find(intent => intent === value) ?? null
}
