import type { LibraryScanRunFileLog, LibraryScanRunGroup } from '@entities/library-item'

export function folderOf(relPath: string): string {
	const at = relPath.lastIndexOf('/')

	return at < 0 ? '' : relPath.slice(0, at)
}

// The needle is already trimmed and lowercased; empty matches everything.
export function matchesSearch(log: LibraryScanRunFileLog, needle: string): boolean {
	return needle === '' || log.rel_path.toLowerCase().includes(needle)
}

function groupTitle(group: LibraryScanRunGroup): string {
	return group.title?.title ?? group.media_ref
}

// The titles a scan matched, by name, kept when the title or one of its files fits
// the search.
export function filterGroups(groups: LibraryScanRunGroup[], needle: string): LibraryScanRunGroup[] {
	return groups
		.filter(
			group =>
				needle === '' ||
				groupTitle(group).toLowerCase().includes(needle) ||
				(group.files ?? []).some(log => matchesSearch(log, needle))
		)
		.sort((a, b) => groupTitle(a).localeCompare(groupTitle(b)))
}
