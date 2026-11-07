import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

import { isAllowedPermission, isAppUrl } from './guards'

const rendererDir = join(process.cwd(), 'out', 'renderer')
const page = (name: string) => pathToFileURL(join(rendererDir, name)).href

describe('isAppUrl', () => {
	describe('packaged', () => {
		const origin = { rendererDir }

		it('accepts the bundle’s own pages, with any route', () => {
			expect(isAppUrl(page('index.html'), origin)).toBe(true)
			expect(isAppUrl(`${page('index.html')}#/library`, origin)).toBe(true)
			expect(isAppUrl(page('splash.html'), origin)).toBe(true)
		})

		it.each([
			'https://attacker.example/',
			'http://127.0.0.1:43711/v1/library/files',
			pathToFileURL(join(rendererDir, '..', 'main', 'index.js')).href,
			pathToFileURL(`${rendererDir}-evil/index.html`).href,
			'file:///C:/Windows/System32/drivers/etc/hosts',
			'not a url'
		])('refuses %s', raw => {
			expect(isAppUrl(raw, origin)).toBe(false)
		})
	})

	describe('development', () => {
		const origin = { rendererDir, devServerUrl: 'http://localhost:5173' }

		it('accepts the dev server', () => {
			expect(isAppUrl('http://localhost:5173/#/library', origin)).toBe(true)
			expect(isAppUrl('http://localhost:5173/splash.html', origin)).toBe(true)
		})

		it('refuses another port or host', () => {
			expect(isAppUrl('http://localhost:5174/', origin)).toBe(false)
			expect(isAppUrl('https://attacker.example/', origin)).toBe(false)
		})
	})
})

describe('isAllowedPermission', () => {
	it('allows what the app uses', () => {
		expect(isAllowedPermission('fullscreen')).toBe(true)
		expect(isAllowedPermission('clipboard-sanitized-write')).toBe(true)
	})

	it.each(['media', 'geolocation', 'notifications', 'clipboard-read', 'openExternal', 'pointerLock'])(
		'denies %s',
		permission => {
			expect(isAllowedPermission(permission)).toBe(false)
		}
	)
})
