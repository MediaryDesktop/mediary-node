// An example manga provider, used by the node's tests. It is not shipped and
// not installed anywhere: Mediary has no built-in providers.
//
// The site it reads is made up. A search is a page of
//   <div class="series" data-id="…"><a class="title">Name</a><span class="year">2020</span></div>
// a series' chapters and a chapter's pages come as JSON, and the images are on
// a host of their own that wants the site as the referrer.

const SITE = 'https://comics.example.org'

/**
 * @typedef {{ id?: string, chapter?: string, title?: string, volume?: string, lang?: string,
 *   group?: string, date?: string }} SiteChapter
 */

class Provider {
	/**
	 * @param {MangaSearchRequest} request
	 * @returns {Promise<Series[]>}
	 */
	async search(request) {
		const res = await fetch(`${SITE}/search?q=${encodeURIComponent(request.query)}`)
		if (!res.ok) {
			throw new Error(`the site answered ${res.status}`)
		}

		return parseHTML(await res.text())
			.find('div.series')
			.map((_, row) => ({
				id: row.attr('data-id') ?? '',
				title: row.find('a.title').text().trim(),
				detail: row.find('span.year').text().trim()
			}))
	}

	/**
	 * @param {string} seriesId
	 * @returns {Promise<MangaChapter[]>}
	 */
	async chapters(seriesId) {
		const res = await fetch(`${SITE}/api/series/${encodeURIComponent(seriesId)}/chapters`)
		if (!res.ok) {
			throw new Error(`the site answered ${res.status}`)
		}

		const language = config.language || 'en'
		const list = /** @type {SiteChapter[]} */ (await res.json())

		return list
			.filter(c => language === 'any' || c.lang === language)
			.map(({ id = '', chapter = '', title, volume, lang, group, date }) => ({
				id,
				number: chapter,
				title,
				volume,
				language: lang,
				groups: group ? [group] : [],
				publishedAt: date
			}))
	}

	/**
	 * @param {string} chapterId
	 * @returns {Promise<MangaPage[]>}
	 */
	async pages(chapterId) {
		const res = await fetch(`${SITE}/api/chapters/${encodeURIComponent(chapterId)}/pages`)
		if (!res.ok) {
			throw new Error(`the site answered ${res.status}`)
		}

		const { base, files } = /** @type {{ base: string, files: string[] }} */ (await res.json())

		return files.map(file => ({ url: `${base}/${file}`, referer: `${SITE}/` }))
	}
}
