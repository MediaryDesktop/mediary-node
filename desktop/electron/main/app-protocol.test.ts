import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import { appFilePath } from './app-protocol'

vi.mock('electron', () => ({ net: {}, protocol: {} }))

const rendererDir = join(process.cwd(), 'out', 'renderer')

describe('appFilePath', () => {
	it('serves the bundle’s files, and the page at the root', () => {
		expect(appFilePath('app://-/', rendererDir)).toBe(join(rendererDir, 'index.html'))
		expect(appFilePath('app://-/index.html#/library', rendererDir)).toBe(join(rendererDir, 'index.html'))
		expect(appFilePath('app://-/assets/pdf.worker.min.mjs', rendererDir)).toBe(
			join(rendererDir, 'assets', 'pdf.worker.min.mjs')
		)
		expect(appFilePath('app://-/logo/my%20icon.png', rendererDir)).toBe(
			join(rendererDir, 'logo', 'my icon.png')
		)
	})

	it('keeps dot segments, which the address parser folds, inside the bundle', () => {
		expect(appFilePath('app://-/../main/index.js', rendererDir)).toBe(
			join(rendererDir, 'main', 'index.js')
		)
		expect(appFilePath('app://-/%2e%2e/main/index.js', rendererDir)).toBe(
			join(rendererDir, 'main', 'index.js')
		)
	})

	it.each([
		'app://-/..%2fmain%2findex.js',
		'app://-/..%5cmain%5cindex.js',
		'app://-/C:%5cWindows%5cwin.ini',
		'app://other/index.html',
		'file:///C:/Windows/win.ini',
		'app://-/%E0%A4%A',
		'not a url'
	])('refuses %s', raw => {
		expect(appFilePath(raw, rendererDir)).toBeNull()
	})
})
