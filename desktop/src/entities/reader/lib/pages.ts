export function clampPage(page: number, total: number): number {
	if (total <= 0) {
		return 0
	}

	return Math.min(Math.max(page, 0), total - 1)
}

export function isLastPage(page: number, total: number): boolean {
	return total > 0 && page >= total - 1
}

// The pages the reader fetches ahead of the one on screen, so turning a page
// does not wait on the archive. Two is what a fast reader can outrun.
export function prefetchIndexes(page: number, total: number, ahead = 2): number[] {
	const out: number[] = []

	for (let i = page + 1; i <= Math.min(page + ahead, total - 1); i += 1) {
		out.push(i)
	}

	return out
}

export interface ChapterRef {
	fileId: number
	chapter: number | null | undefined
}

// Neighbours in reading order, which is chapter number order. A chapter without a
// number has no place in that order and is not offered as a neighbour.
export function neighbourChapters(
	chapters: ChapterRef[],
	fileId: number
): { previous: ChapterRef | null; next: ChapterRef | null } {
	const numbered = chapters
		.filter((item): item is ChapterRef & { chapter: number } => typeof item.chapter === 'number')
		.sort((a, b) => a.chapter - b.chapter)

	const at = numbered.findIndex(item => item.fileId === fileId)
	if (at < 0) {
		return { previous: null, next: null }
	}

	return {
		previous: numbered[at - 1] ?? null,
		next: numbered[at + 1] ?? null
	}
}
