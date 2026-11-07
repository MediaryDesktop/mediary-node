export interface ChapterOption {
	ref: string
	number: string | null
	title: string
	source: string
	sourceName: string
	detail: string
	language?: string
	groups?: string[]
	pages?: number
	externalUrl?: string
}

export interface ChapterRow {
	key: string
	number: string | null
	options: ChapterOption[]
}

export const LOCAL_SOURCE = 'local'

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

export function filterChapters(rows: ChapterRow[], source: string): ChapterRow[] {
	return rows
		.map(row => ({ ...row, options: row.options.filter(option => option.source === source) }))
		.filter(row => row.options.length > 0)
}

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

export function isChapterRead(number: string | null, progress: number): boolean {
	const value = numeric(number)

	return value !== null && value > 0 && value <= progress
}

const NUMBERED = /(?:\bch(?:apter|\.)?|#)\s*(\d+(?:\.\d+)?)/i
const TRAILING = /(\d+(?:\.\d+)?)\s*$/

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
