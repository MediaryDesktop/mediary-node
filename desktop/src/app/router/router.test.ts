import { beforeEach, describe, expect, it, vi } from 'vitest'

const VERIFIED = {
	id: 'acc-1',
	email: 'lukas@example.test',
	display_name: 'Lukas',
	email_verified: true
}

const UNVERIFIED = { ...VERIFIED, email_verified: false }

async function landAt(path: string, session: unknown) {
	vi.resetModules()

	window.mediary.session.read = vi.fn().mockResolvedValue(session)
	window.location.hash = `#${path}`

	const { router } = await import('./router')

	await router.load()

	return router.state.location.pathname
}

beforeEach(() => {
	vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
})

describe('guest routes', () => {
	it('lets a visitor without a session through', async () => {
		await expect(landAt('/sign-in', null)).resolves.toBe('/sign-in')
	})

	it('sends a verified account home', async () => {
		await expect(landAt('/sign-in', { token: 't', account: VERIFIED })).resolves.toBe('/')
	})

	it('sends an unverified account to email confirmation', async () => {
		await expect(landAt('/sign-up/email', { token: 't', account: UNVERIFIED })).resolves.toBe(
			'/verify-email'
		)
	})

	it('guards password recovery too', async () => {
		await expect(landAt('/reset-password', { token: 't', account: VERIFIED })).resolves.toBe('/')
	})
})

describe('/verify-email', () => {
	it('turns a visitor without a session away', async () => {
		await expect(landAt('/verify-email', null)).resolves.toBe('/sign-in')
	})

	it('turns an already verified account away', async () => {
		await expect(landAt('/verify-email', { token: 't', account: VERIFIED })).resolves.toBe('/')
	})

	it('keeps an unverified account', async () => {
		await expect(landAt('/verify-email', { token: 't', account: UNVERIFIED })).resolves.toBe(
			'/verify-email'
		)
	})
})

describe('/new-password', () => {
	it('falls back to the request screen without an email', async () => {
		await expect(landAt('/new-password', null)).resolves.toBe('/reset-password')
	})

	it('opens with an email in the search params', async () => {
		await expect(landAt('/new-password?email=lukas%40example.test', null)).resolves.toBe('/new-password')
	})
})
