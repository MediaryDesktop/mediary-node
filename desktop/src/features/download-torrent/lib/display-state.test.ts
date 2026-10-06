import { describe, expect, it } from 'vitest'

import type { TorrentDownload } from '@entities/torrent'

import { displayState } from './display-state'

const BASE: TorrentDownload = {
	id: 1,
	info_hash: 'abc',
	media_ref: 'anilist:1',
	title: 'Frieren',
	name: 'Frieren S01',
	source: 'magnet',
	state: 'downloading',
	imported: 0,
	created_at: '2026-10-06T12:00:00Z'
}

function live(state: string, paused = false): TorrentDownload {
	return {
		...BASE,
		live: { state, paused, progress: 0.5, size: 1, dl_speed: 0, up_speed: 0, seeds: 0, peers: 0 }
	}
}

describe('torrent display state', () => {
	it('follows the node once the files are its business', () => {
		expect(displayState({ ...BASE, state: 'importing' })).toBe('importing')
		expect(displayState({ ...BASE, state: 'done' })).toBe('done')
		expect(displayState({ ...BASE, state: 'failed' })).toBe('failed')
	})

	it('waits for qBittorrent before it has said anything', () => {
		expect(displayState(BASE)).toBe('unknown')
	})

	it('folds qBittorrent 4 and 5 state names into a few', () => {
		expect(displayState(live('pausedDL', true))).toBe('paused')
		expect(displayState(live('stoppedDL', true))).toBe('paused')
		expect(displayState(live('stalledDL'))).toBe('stalled')
		expect(displayState(live('queuedDL'))).toBe('queued')
		expect(displayState(live('checkingResumeData'))).toBe('checking')
		expect(displayState(live('metaDL'))).toBe('metadata')
		expect(displayState(live('missingFiles'))).toBe('error')
		expect(displayState(live('forcedDL'))).toBe('downloading')
		expect(displayState(live('downloading'))).toBe('downloading')
	})
})
