// An example torrent provider, used by the node's tests. It is not shipped and
// not installed anywhere: Mediary has no built-in providers.
//
// The site it reads is made up. Each search result is a table row:
//   <tr data-hash="…"><td class="name"><a href="/view/1">Title</a></td>
//     <td class="size">1.4 GiB</td><td class="seeders">12</td>
//     <td class="peers">3</td><td class="date" data-ts="1700000000"></td></tr>

/** @type {Record<string, number>} */
const UNITS = { B: 1, KiB: 1024, MiB: 1024 ** 2, GiB: 1024 ** 3, TiB: 1024 ** 4 }

/** @param {string} text */
function bytes(text) {
	const [value, unit] = text.trim().split(/\s+/)
	return Math.round(parseFloat(value) * (UNITS[unit] || 0))
}

class Provider {
	/**
	 * @param {SearchRequest} request
	 * @returns {Promise<Release[]>}
	 */
	async search(request) {
		const base = `https://${config.mirror || 'tracker.example.org'}`
		const page = await fetch(`${base}/search?q=${encodeURIComponent(request.query)}`)
		if (!page.ok) {
			throw new Error(`the site answered ${page.status}`)
		}

		const doc = parseHTML(await page.text())

		return doc.find('tr[data-hash]').map((_, row) => {
			const name = row.find('td.name a')
			const hash = row.attr('data-hash') ?? ''

			return {
				title: name.text().trim(),
				infoHash: hash,
				magnet: `magnet:?xt=urn:btih:${hash}`,
				pageUrl: base + name.attr('href'),
				size: bytes(row.find('td.size').text()),
				seeders: parseInt(row.find('td.seeders').text(), 10) || 0,
				peers: parseInt(row.find('td.peers').text(), 10) || 0,
				publishedAt: new Date(parseInt(row.find('td.date').attr('data-ts') ?? '0', 10) * 1000).toISOString()
			}
		})
	}
}
