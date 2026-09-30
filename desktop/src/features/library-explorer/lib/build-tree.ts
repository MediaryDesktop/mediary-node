import { isIgnored, isMatched } from '@entities/library-item'
import type { LibraryFile, LibraryRoot } from '@entities/library-item'

export type ExplorerFilter = 'unmatched' | 'auto' | 'ignored' | 'missing'

export const EXPLORER_FILTERS: readonly ExplorerFilter[] = ['unmatched', 'auto', 'ignored', 'missing']

export interface TreeFile {
	kind: 'file'
	key: string
	name: string
	file: LibraryFile
}

export interface TreeFolder {
	kind: 'folder'
	key: string
	name: string
	children: TreeNode[]

	files: number
	matched: number
}

export type TreeNode = TreeFolder | TreeFile

export interface FlatNode {
	node: TreeNode
	depth: number
}

export function matchesFilter(file: LibraryFile, filter: ExplorerFilter | null): boolean {
	switch (filter) {
		case 'unmatched':
			return !isMatched(file) && !isIgnored(file)
		// A match the node made on its own and nobody confirmed — the one a rescan
		// is still allowed to change.
		case 'auto':
			return file.match?.source === 'auto'
		case 'ignored':
			return isIgnored(file)
		case 'missing':
			return file.missing
		default:
			return true
	}
}

export function matchesSearch(file: LibraryFile, needle: string): boolean {
	if (needle === '') {
		return true
	}

	return file.rel_path.toLowerCase().includes(needle)
}

// The node stores a file as a root plus a path under it, which is already the
// shape of a tree — it just has to be split back apart. Folders exist only as
// prefixes of the files inside them, so a folder with nothing left after a
// filter simply never gets created.
export function buildTree(files: LibraryFile[], roots: LibraryRoot[]): TreeFolder[] {
	const byRoot = new Map<number, TreeFolder>()

	for (const root of roots) {
		byRoot.set(root.id, emptyFolder(`root:${root.id}`, root.path))
	}

	for (const file of files) {
		const rootFolder = byRoot.get(file.root_id) ?? emptyFolder(`root:${file.root_id}`, rootNameOf(file))
		byRoot.set(file.root_id, rootFolder)

		const segments = file.rel_path.split('/').filter(segment => segment !== '')
		const name = segments.pop() ?? file.rel_path

		let parent = rootFolder
		let key = rootFolder.key

		for (const segment of segments) {
			key = `${key}/${segment}`

			let next = parent.children.find(
				(child): child is TreeFolder => child.kind === 'folder' && child.key === key
			)

			if (!next) {
				next = emptyFolder(key, segment)
				parent.children.push(next)
			}

			parent = next
		}

		parent.children.push({ kind: 'file', key: `file:${file.id}`, name, file })
	}

	const tree = [...byRoot.values()].filter(folder => folder.children.length > 0)

	for (const folder of tree) {
		sortFolder(folder)
		countFolder(folder)
	}

	return tree.sort((left, right) => left.name.localeCompare(right.name))
}

// Folders first, then by name — the order a file manager uses, and the one that
// keeps a season's episodes together under the show they belong to.
function sortFolder(folder: TreeFolder) {
	folder.children.sort((left, right) => {
		if (left.kind !== right.kind) {
			return left.kind === 'folder' ? -1 : 1
		}

		return left.name.localeCompare(right.name, undefined, { numeric: true })
	})

	for (const child of folder.children) {
		if (child.kind === 'folder') {
			sortFolder(child)
		}
	}
}

function countFolder(folder: TreeFolder): TreeFolder {
	let files = 0
	let matched = 0

	for (const child of folder.children) {
		if (child.kind === 'file') {
			files += 1
			matched += isMatched(child.file) ? 1 : 0

			continue
		}

		const counted = countFolder(child)
		files += counted.files
		matched += counted.matched
	}

	folder.files = files
	folder.matched = matched

	return folder
}

// Only what is on screen: a collapsed folder contributes one row, not the
// thousand files under it.
export function flattenTree(tree: TreeFolder[], expanded: ReadonlySet<string>, depth = 0): FlatNode[] {
	const rows: FlatNode[] = []

	for (const node of tree) {
		rows.push({ node, depth })

		if (node.kind === 'folder' && expanded.has(node.key)) {
			rows.push(...flattenTree(node.children as TreeFolder[], expanded, depth + 1))
		}
	}

	return rows
}

function emptyFolder(key: string, name: string): TreeFolder {
	return { kind: 'folder', key, name, children: [], files: 0, matched: 0 }
}

function rootNameOf(file: LibraryFile): string {
	return file.path.slice(0, Math.max(file.path.length - file.rel_path.length - 1, 0))
}
