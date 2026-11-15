import { allSettled, fork } from 'effector'
import { describe, expect, it, vi } from 'vitest'

import { checkTorrentClientFx, putTorrentSettingsFx } from '@entities/torrent'
import type { TorrentSettings } from '@entities/torrent'

import { clientForm } from './form'

vi.mock('@shared/i18n', () => ({ translate: (key: string) => key }))

const SETTINGS: TorrentSettings = {
	client: 'qbittorrent',
	url: 'http://localhost:8080',
	username: 'admin',
	has_password: true,
	root_id: 0,
	default_folder: 'C:/Downloads',
	path_map: { client: '', node: '' }
}

function deferred<T>() {
	let resolve!: (value: T) => void
	const promise = new Promise<T>(done => {
		resolve = done
	})
	return { promise, resolve }
}

describe('the torrent client form', () => {
	it('shows a check only for the fields it was run with', async () => {
		const answer = deferred<{ version: string }>()
		const scope = fork({ handlers: [[checkTorrentClientFx, () => answer.promise]] })

		await allSettled(clientForm.opened, { scope, params: SETTINGS })
		const checking = allSettled(clientForm.checkRequested, { scope })

		const changing = allSettled(clientForm.connectionChanged, {
			scope,
			params: { field: 'url', value: 'http://nas:8080' }
		})
		answer.resolve({ version: '5.0' })
		await Promise.all([checking, changing])

		expect(scope.getState(clientForm.$check)).toBeNull()
	})

	it('reports a check that answers for what is on screen', async () => {
		const scope = fork({ handlers: [[checkTorrentClientFx, () => Promise.resolve({ version: '5.0' })]] })

		await allSettled(clientForm.opened, { scope, params: SETTINGS })
		await allSettled(clientForm.checkRequested, { scope })

		expect(scope.getState(clientForm.$check)).toEqual({ ok: true, version: '5.0' })
	})

	it('does not save half a path mapping', async () => {
		const save = vi.fn().mockResolvedValue(SETTINGS)
		const scope = fork({ handlers: [[putTorrentSettingsFx, save]] })

		await allSettled(clientForm.opened, { scope, params: SETTINGS })
		await allSettled(clientForm.mappingChanged, {
			scope,
			params: { field: 'mapClient', value: '/downloads' }
		})
		await allSettled(clientForm.submitted, { scope })

		expect(scope.getState(clientForm.$canSave)).toBe(false)
		expect(save).not.toHaveBeenCalled()
	})

	it('saves what was typed, keeps the stored password, and starts again from the answer', async () => {
		const saved = { ...SETTINGS, url: 'http://nas:8080' }
		const save = vi.fn().mockResolvedValue(saved)
		const scope = fork({ handlers: [[putTorrentSettingsFx, save]] })

		await allSettled(clientForm.opened, { scope, params: SETTINGS })
		await allSettled(clientForm.connectionChanged, {
			scope,
			params: { field: 'url', value: 'http://nas:8080' }
		})
		await allSettled(clientForm.submitted, { scope })

		expect(save).toHaveBeenCalledWith(
			expect.objectContaining({ client: 'qbittorrent', url: 'http://nas:8080', password: undefined })
		)
		expect(scope.getState(clientForm.$fields)?.url).toBe('http://nas:8080')
		expect(scope.getState(clientForm.$settings)).toEqual(saved)
	})

	it('goes back to what is saved on cancel', async () => {
		const scope = fork()

		await allSettled(clientForm.opened, { scope, params: SETTINGS })
		await allSettled(clientForm.picked, { scope, params: 'embedded' })
		await allSettled(clientForm.reset, { scope })

		expect(scope.getState(clientForm.$fields)?.choice).toBe('qbittorrent')
	})
})
