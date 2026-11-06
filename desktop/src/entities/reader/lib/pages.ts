export function clampPage(page: number, total: number): number {
	if (total <= 0) {
		return 0
	}

	return Math.min(Math.max(page, 0), total - 1)
}

export function isLastPage(page: number, total: number): boolean {
	return total > 0 && page >= total - 1
}

export function prefetchIndexes(page: number, total: number, ahead = 2): number[] {
	const out: number[] = []

	for (let i = page + 1; i <= Math.min(page + ahead, total - 1); i += 1) {
		out.push(i)
	}

	return out
}
