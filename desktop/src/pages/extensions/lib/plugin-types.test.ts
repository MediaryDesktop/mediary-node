import { describe, expect, it } from 'vitest'

import { byType } from './plugin-types'

describe('byType', () => {
	it('groups plugins by type, known types first and in their order', () => {
		const plugins = [
			{ id: 'a', type: 'manga-provider' },
			{ id: 'b', type: 'subtitle-provider' },
			{ id: 'c', type: 'torrent-provider' },
			{ id: 'd', type: 'manga-provider' }
		]

		expect(byType(plugins).map(([type, items]) => [type, items.map(item => item.id)])).toEqual([
			['torrent-provider', ['c']],
			['manga-provider', ['a', 'd']],
			['subtitle-provider', ['b']]
		])
	})
})
