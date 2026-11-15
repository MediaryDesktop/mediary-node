import { describe, expect, it } from 'vitest'

import type { TorrentSettings } from '@entities/torrent'

import { checkParams, fieldsOf, hasProblems, problemsOf, settingsUpdate } from './form'

const SETTINGS: TorrentSettings = {
	client: 'qbittorrent',
	url: 'http://localhost:8080',
	username: 'admin',
	has_password: true,
	root_id: 0,
	default_folder: 'C:/Downloads',
	path_map: { client: '', node: '' }
}

describe('torrent client form rules', () => {
	it('starts from what is saved, with the password left blank', () => {
		expect(fieldsOf(SETTINGS)).toMatchObject({
			choice: 'qbittorrent',
			url: 'http://localhost:8080',
			password: ''
		})
		expect(fieldsOf({ ...SETTINGS, client: '' }).choice).toBe('none')
	})

	it('refuses half a path mapping and a qBittorrent without an address', () => {
		const fields = fieldsOf(SETTINGS)

		expect(hasProblems(problemsOf(fields, false))).toBe(false)
		expect(problemsOf({ ...fields, mapClient: '/downloads' }, false).mappingHalf).toBe(true)
		expect(
			problemsOf({ ...fields, mapClient: '/downloads', mapNode: 'D:/Anime' }, false).mappingHalf
		).toBe(false)
		expect(problemsOf({ ...fields, url: '  ' }, false).missingUrl).toBe(true)
	})

	it('asks for a debrid service before debrid can be chosen', () => {
		const fields = { ...fieldsOf(SETTINGS), choice: 'debrid' as const }

		expect(problemsOf(fields, false).missingDebrid).toBe(true)
		expect(problemsOf(fields, true).missingDebrid).toBe(false)
	})

	it('keeps the stored password when the field is left empty', () => {
		const fields = fieldsOf(SETTINGS)

		expect(settingsUpdate(fields, true).password).toBeUndefined()
		expect(settingsUpdate({ ...fields, password: 'new' }, true).password).toBe('new')
		expect(settingsUpdate(fields, false).password).toBe('')
	})

	it('checks only what the chosen client needs', () => {
		expect(checkParams(fieldsOf(SETTINGS), true)).toEqual({
			client: 'qbittorrent',
			url: 'http://localhost:8080',
			username: 'admin',
			password: undefined
		})
		expect(checkParams({ ...fieldsOf(SETTINGS), choice: 'embedded' }, true)).toEqual({
			client: 'embedded',
			username: ''
		})
	})
})
