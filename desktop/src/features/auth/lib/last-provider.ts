/**
 * Which provider signed this machine in last time.
 *
 * A convenience with a real payoff: an account created through Google and then
 * "signed in" through the email form is a support ticket, and the badge is what
 * prevents it. Local to the machine, never sent anywhere.
 */

const STORAGE_KEY = 'mediary.lastAuthProvider'

/** Wrapped, like every other storage read: a packaged renderer with site data
 * disabled throws on access rather than returning null. */
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
	} catch {
		// A hint that cannot be saved is worth less than a crash costs.
	}
}
