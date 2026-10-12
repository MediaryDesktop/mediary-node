import { describe, expect, it } from 'vitest'

import type { TorrentRelease } from '@entities/torrent'

import { downloadRequests, filterReleases } from './releases'

function release(id: string, from: number, to: number): TorrentRelease {
	return {
		id,
		source_id: 1,
		source_name: 'Jackett',
		title: 'Frieren',
		size: 1,
		seeders: 1,
		peers: 0,
		grabs: 0,
		batch: from !== to,
		match: 'any',
		score: 0,
		eligible: true,
		best: false,
		episodes: { from, to }
	}
}

const single = release('single', 3, 3)
const batch = release('batch', 1, 12)
const other = release('other', 20, 20)

describe('filterReleases', () => {
	it('keeps episodes or batches by kind', () => {
		const all = [single, batch]

		expect(filterReleases(all, { kind: 'all', onlyMissing: false, missing: null })).toEqual(all)
		expect(filterReleases(all, { kind: 'episodes', onlyMissing: false, missing: null })).toEqual([single])
		expect(filterReleases(all, { kind: 'batches', onlyMissing: false, missing: null })).toEqual([batch])
	})

	it('drops releases without a missing episode only when asked and when something is missing', () => {
		const all = [single, other]

		expect(filterReleases(all, { kind: 'all', onlyMissing: true, missing: [3] })).toEqual([single])
		expect(filterReleases(all, { kind: 'all', onlyMissing: true, missing: [] })).toEqual(all)
	})
})

describe('downloadRequests', () => {
	const target = { mediaRef: 'anilist:1', title: 'Frieren', missing: [3, 4] }

	it('asks a batch for the missing episodes it holds and to wait for its files', () => {
		expect(downloadRequests([batch], target)).toEqual([
			{
				media_ref: 'anilist:1',
				title: 'Frieren',
				release_id: 'batch',
				episodes: [3, 4],
				choose_files: true
			}
		])
	})

	it('gives a single episode its own number even when nothing is missing', () => {
		expect(downloadRequests([other], target)[0]?.episodes).toEqual([20])
	})
})
