export type CoverSelection =
	| { kind: 'keep' }
	| { kind: 'remove' }
	| { kind: 'url'; value: string; previewUrl: string; source: 'search' | 'url' }
	| { kind: 'data'; value: string; previewUrl: string; name: string; size: number }

// What the node is sent to set a cover from, or null when the choice is to keep
// or remove it rather than set one.
export function coverSource(selection: CoverSelection): { url?: string; data?: string } | null {
	if (selection.kind === 'url') {
		return { url: selection.value }
	}

	if (selection.kind === 'data') {
		return { data: selection.value }
	}

	return null
}

// The picture the form shows for the title: the one it already has while the
// choice is to keep it, none once it is removed, otherwise the new pick.
export function coverPreviewUrl(
	selection: CoverSelection,
	existing: string | null | undefined
): string | null {
	if (selection.kind === 'remove') {
		return null
	}

	if (selection.kind === 'keep') {
		return existing ?? null
	}

	return selection.previewUrl
}
