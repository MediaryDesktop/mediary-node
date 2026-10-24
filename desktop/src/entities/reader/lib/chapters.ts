// One list of a title's chapters, whichever sources hold them. A chapter that is
// in the library and on a server is one row, not two: the row opens the copy the
// user has nearest, and offers the others.

export interface ChapterOption {
	ref: string
	// The chapter number as the source writes it: "12", "12.5", or null.
	number: string | null
	title: string
	// "local" for the library, otherwise the source's id, such as "opds:3".
	source: string
	sourceName: string
	// What tells this copy apart: a file name, a page count, who translated it.
	detail: string
	// The same, field by field, for a list that shows them in columns.
	language?: string
	groups?: string[]
	// 0 or absent: the source does not say until the chapter is opened.
	pages?: number
	// The publisher's page, for a chapter the source only links to: it opens in the
	// browser rather than in the reader.
	externalUrl?: string
}

export interface ChapterRow {
	key: string
	number: string | null
	// The options, nearest first: the library, then the user's servers, then the rest.
	options: ChapterOption[]
}

export const LOCAL_SOURCE = 'local'

// Nearest first: a file on disk needs no network, the user's own server needs only
// theirs, anything else needs the internet.
function rank(option: ChapterOption): number {
	if (option.source === LOCAL_SOURCE) {
		return 0
	}
	if (option.source.startsWith('opds:')) {
		return 1
	}

	return 2
}

function numeric(number: string | null): number | null {
	if (number === null || number.trim() === '') {
		return null
	}

	const value = Number(number)

	return Number.isFinite(value) ? value : null
}

// mergeChapters groups copies of the same chapter by number. "012" and "12" are
// the same chapter; "12" and "12.5" are not. An unnumbered chapter has nothing to
// match on, so it is a row of its own, after the numbered ones.
export function mergeChapters(options: ChapterOption[]): ChapterRow[] {
	const numbered = new Map<number, ChapterRow>()
	const unnumbered: ChapterRow[] = []

	for (const option of options) {
		const value = numeric(option.number)

		if (value === null) {
			unnumbered.push({ key: option.ref, number: null, options: [option] })
			continue
		}

		const row = numbered.get(value)
		if (row) {
			row.options.push(option)
		} else {
			numbered.set(value, { key: String(value), number: String(value), options: [option] })
		}
	}

	const rows = [...numbered.entries()].sort(([a], [b]) => a - b).map(([, row]) => row)

	for (const row of rows) {
		row.options.sort((a, b) => rank(a) - rank(b))
	}

	return [...rows, ...unnumbered]
}

// filterChapters keeps only one source's copies, and the rows that have one.
export function filterChapters(rows: ChapterRow[], source: string): ChapterRow[] {
	return rows
		.map(row => ({ ...row, options: row.options.filter(option => option.source === source) }))
		.filter(row => row.options.length > 0)
}

// The chapters either side of the one being read, in number order and across
// sources: the next chapter after a local 12 may be 13 on the user's server.
export function neighbourChapters(
	rows: ChapterRow[],
	ref: string
): { previous: ChapterOption | null; next: ChapterOption | null } {
	const numbered = rows.filter(row => row.number !== null)
	const at = numbered.findIndex(row => row.options.some(option => option.ref === ref))

	if (at < 0) {
		return { previous: null, next: null }
	}

	return {
		previous: numbered[at - 1]?.options[0] ?? null,
		next: numbered[at + 1]?.options[0] ?? null
	}
}

// isChapterRead says whether the list's progress has reached the chapter. An extra
// such as 12.5 is read once the list is past 12, as reading it never moves progress.
export function isChapterRead(number: string | null, progress: number): boolean {
	const value = numeric(number)

	return value !== null && value > 0 && value <= progress
}

const NUMBERED = /(?:\bch(?:apter|\.)?|#)\s*(\d+(?:\.\d+)?)/i
const TRAILING = /(\d+(?:\.\d+)?)\s*$/

// chapterNumberFromName reads the chapter number out of a file name, for a file the
// library holds without one: it counts whole chapters only, so a saved extra such
// as "Berserk - Ch. 013.5.cbz" joins the title with no number of its own. The rules
// are the node's for OPDS titles: a chapter marker first, then a trailing number.
export function chapterNumberFromName(path: string): string | null {
	const name = (path.split(/[\\/]/).pop() ?? '').replace(/\.[^.]+$/, '')
	const match = NUMBERED.exec(name) ?? TRAILING.exec(name)

	if (!match?.[1]) {
		return null
	}

	const [whole = '', fraction] = match[1].split('.')
	const trimmed = whole.replace(/^0+(?=\d)/, '')

	return fraction ? `${trimmed}.${fraction}` : trimmed
}
