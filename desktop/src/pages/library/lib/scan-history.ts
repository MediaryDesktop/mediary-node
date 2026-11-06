import type { LibraryScanRunFileLog, LibraryScanRunGroup } from '@entities/library-item'

export function folderOf(relPath: string): string {
	const at = relPath.lastIndexOf('/')

	return at < 0 ? '' : relPath.slice(0, at)
}

export function matchesSearch(log: LibraryScanRunFileLog, needle: string): boolean {
	return needle === '' || log.rel_path.toLowerCase().includes(needle)
}

function groupTitle(group: LibraryScanRunGroup): string {
	return group.title?.title ?? group.media_ref
}

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
