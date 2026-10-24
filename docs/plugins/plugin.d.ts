// Types for a Mediary plugin: a torrent provider or a manga provider.
//
// A plugin is one JavaScript file that defines `class Provider`. A torrent
// provider has an async `search` method: the node calls it with a search and
// expects releases back; parsing their names, matching episodes, ranking by the
// user's profile, downloading and streaming are the node's job, not the
// plugin's. A manga provider has `search`, `chapters` and `pages` (see
// MangaProvider below); the node fetches the pages' images itself.
//
// The script runs in a sandbox. These globals are all it has: no `require`,
// no files, no processes, no timers. `fetch` reaches only the hosts listed in
// the manifest's `network`, never a local or private address.

/** What the node is looking for. */
interface SearchRequest {
	/** The text to search for: a title, often with an episode number. The node
	 * sends several of these for one search, one call each. */
	query: string
	/** Every name the title is known by, the main one first. */
	titles: string[]
	year?: number
	/** The episode wanted; absent when any episode will do. */
	episode?: number
	/** For a show numbered by season: the season, the episode counting within it. */
	season?: number
	anilistId?: number
	tmdbId?: number
}

/** One release found. A release needs a title and one way to get it: a magnet
 * link, a link to its .torrent file, or an info hash. */
interface Release {
	title: string
	magnet?: string
	/** A link to the .torrent file, on one of the manifest's hosts. */
	link?: string
	/** 40 hex characters. */
	infoHash?: string
	/** Bytes. */
	size?: number
	seeders?: number
	peers?: number
	/** How many times it was downloaded, when the site says. */
	grabs?: number
	/** ISO 8601. */
	publishedAt?: string
	/** The release's page on the site, for the user to open. */
	pageUrl?: string
}

interface Provider {
	search(request: SearchRequest): Promise<Release[]>
}

/** What a manga provider is asked to find, to link a title to a series. */
interface MangaSearchRequest {
	/** The text to search for: one of the title's names, or what the user typed. */
	query: string
	/** Every name the title is known by, the main one first. */
	titles: string[]
	anilistId?: number
}

/** A series on the site. */
interface Series {
	/** The site's own id, as `chapters` takes it back. Up to 512 characters. */
	id: string
	title: string
	/** Tells similar names apart: a year, a kind. */
	detail?: string
}

/** A chapter of a series. */
interface MangaChapter {
	/** The site's own id, as `pages` takes it back. Up to 512 characters. */
	id: string
	/** As the site numbers it: "13", "13.5", "" for an extra. A whole number
	 * moves the reading progress on AniList; anything else does not. */
	number: string
	title?: string
	volume?: string
	/** BCP 47, e.g. "en", "uk". */
	language?: string
	/** Who translated it, shown beside the chapter. */
	groups?: string[]
	/** ISO 8601. */
	publishedAt?: string
}

/** One page's image. The node fetches it, never the plugin. */
interface MangaPage {
	/** On one of the manifest's hosts. */
	url: string
	/** Sent as the Referer, for sites that check it; also on the manifest's hosts. */
	referer?: string
}

interface MangaProvider {
	search(request: MangaSearchRequest): Promise<Series[]>
	chapters(seriesId: string): Promise<MangaChapter[]>
	pages(chapterId: string): Promise<MangaPage[]>
}

interface RequestInit {
	method?: 'GET' | 'POST'
	headers?: Record<string, string>
	/** Sent as is; set Content-Type yourself. */
	body?: string
}

interface Response {
	readonly ok: boolean
	readonly status: number
	/** The address after redirects. Every redirect stays on the manifest's hosts. */
	readonly url: string
	readonly headers: { get(name: string): string | null }
	text(): Promise<string>
	json(): Promise<unknown>
}

/** Only the hosts in the manifest's `network`; anything else rejects. Bodies
 * are capped in size, and a call makes a limited number of requests. */
declare function fetch(url: string, init?: RequestInit): Promise<Response>

/** Elements matched by a CSS selector, as in jQuery or cheerio. */
interface Selection {
	readonly length: number
	find(selector: string): Selection
	first(): Selection
	eq(index: number): Selection
	/** The text of the elements, concatenated. */
	text(): string
	attr(name: string): string | undefined
	each(fn: (index: number, element: Selection) => void): Selection
	map<T>(fn: (index: number, element: Selection) => T): T[]
}

/** Parses HTML without running any of its scripts. */
declare function parseHTML(html: string): Selection

/** The values of the manifest's `config` fields, as the user set them; a field
 * left empty has its default. Read-only. */
declare const config: Readonly<Record<string, string>>

/** Goes to the node's log, with the plugin's id; rate-limited. */
declare const console: {
	log(...values: unknown[]): void
	warn(...values: unknown[]): void
	error(...values: unknown[]): void
}
