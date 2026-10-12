import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useEffect, useMemo, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { Drawer, EmptyState, Icon, Input } from '@shared/ui'

import { libraryRootsQuery, libraryTreeQuery } from '@entities/library-item'
import type { LibraryFile } from '@entities/library-item'

import { allFolderKeys, buildTree, flattenTree, matchesFilter, matchesSearch } from './lib/build-tree'
import type { ExplorerFilter, TreeNode } from './lib/build-tree'
import { useTreeSelection } from './lib/useTreeSelection'
import styles from './LibraryExplorer.module.scss'
import { libraryExplorerModel } from './model/model'
import { DeleteFilesModal } from './ui/delete-files-modal/DeleteFilesModal'
import { DetailPanel } from './ui/detail-panel/DetailPanel'
import { ExplorerRow } from './ui/explorer-row/ExplorerRow'
import { ExplorerToolbar } from './ui/explorer-toolbar/ExplorerToolbar'
import { SelectionActions } from './ui/explorer-toolbar/selection-actions/SelectionActions'

export interface LibraryExplorerProps {
	// Matching lives in its own slice; the page that mounts the explorer hands
	// this in rather than the two features reaching into each other.
	onMatchMany: (files: LibraryFile[]) => void
}

// The library as the folders on disk: search and filter it, open a file's details,
// tick files to match, ignore or delete them together.
export function LibraryExplorer({ onMatchMany }: LibraryExplorerProps) {
	const { t } = useTranslation()
	const navigate = useNavigate()

	const [open, closed, search, setSearch] = useUnit([
		libraryExplorerModel.$open,
		libraryExplorerModel.closed,
		libraryExplorerModel.$search,
		libraryExplorerModel.searchChanged
	])

	const [treeData, treePending, startTree] = useUnit([
		libraryTreeQuery.$data,
		libraryTreeQuery.$pending,
		libraryTreeQuery.start
	])

	const [rootsData, startRoots] = useUnit([libraryRootsQuery.$data, libraryRootsQuery.start])

	const [filter, setFilter] = useState<ExplorerFilter | null>(null)
	const [expanded, setExpanded] = useState<Set<string>>(new Set())
	const [focused, setFocused] = useState<TreeNode | null>(null)
	const [selecting, setSelecting] = useState(false)
	const [confirmingDelete, setConfirmingDelete] = useState(false)
	const selection = useTreeSelection()

	useEffect(() => {
		if (open) {
			startTree()
			startRoots()
		}
	}, [open, startTree, startRoots])

	const files = useMemo(() => treeData?.files.items ?? [], [treeData])
	const titles = useMemo(() => treeData?.files.titles ?? [], [treeData])
	const roots = useMemo(() => rootsData?.roots ?? [], [rootsData])

	const unmatchedCount = useMemo(
		() => files.filter(file => matchesFilter(file, 'unmatched')).length,
		[files]
	)

	const tree = useMemo(() => {
		const needle = search.trim().toLowerCase()

		return buildTree(
			files.filter(file => matchesFilter(file, filter) && matchesSearch(file, needle)),
			roots
		)
	}, [files, roots, filter, search])

	// A filter or a search that narrows the library to a handful of files is
	// useless behind closed folders, so narrowing opens everything it kept.
	const narrowed = filter !== null || search.trim() !== ''

	const rows = useMemo(
		() => flattenTree(tree, narrowed ? allFolderKeys(tree) : expanded),
		[tree, expanded, narrowed]
	)

	const titleByRef = useMemo(() => new Map(titles.map(title => [title.media_ref, title.title])), [titles])

	const chosen = useMemo(
		() => files.filter(file => selection.selected.has(file.id)),
		[files, selection.selected]
	)

	const toggleFolder = (key: string) =>
		setExpanded(current => {
			const next = new Set(current)

			if (!next.delete(key)) {
				next.add(key)
			}

			return next
		})

	return (
		<>
			<Drawer
				open={open}
				onOpenChange={next => !next && closed()}
				title={t('library.explorer.title')}
				side='bottom'
				size='sheet'
				closable={false}
				headerAction={
					<ExplorerToolbar
						unmatchedCount={unmatchedCount}
						filter={filter}
						onFilter={setFilter}
						selecting={selecting}
						onToggleSelecting={() => {
							setSelecting(current => !current)
							selection.clear()
						}}
						refreshing={treePending}
						onRefresh={() => startTree()}
						selectionActions={
							selecting &&
							chosen.length > 0 && (
								<SelectionActions
									chosen={chosen}
									onMatchMany={onMatchMany}
									onDelete={() => setConfirmingDelete(true)}
									onDone={selection.clear}
								/>
							)
						}
					/>
				}
			>
				<div className={styles.body}>
					<div className={styles.main}>
						<Input
							value={search}
							onChange={event => setSearch(event.target.value)}
							placeholder={t('library.explorer.search')}
							startIcon={<Icon name='common/search' size={18} />}
						/>

						<div className={styles.tree} role='tree'>
							{rows.length > 0
								? rows.map(row => (
										<ExplorerRow
											key={row.node.key}
											row={row}
											expanded={narrowed || expanded.has(row.node.key)}
											focused={focused?.key === row.node.key}
											selecting={selecting}
											checked={selecting ? selection.stateOf(row.node) : false}
											title={
												row.node.kind === 'file' && row.node.file.match
													? titleByRef.get(row.node.file.match.media_ref)
													: undefined
											}
											onToggle={toggleFolder}
											onFocus={next => setFocused(next.node)}
											onCheck={(next, checked) => selection.check(next.node, checked)}
										/>
									))
								: !treePending && (
										<EmptyState size='small' title={t('library.explorer.nothing')} />
									)}
						</div>
					</div>

					<DetailPanel
						node={focused}
						titles={titles}
						onRead={fileId =>
							void navigate({ to: '/read-book/$fileId', params: { fileId: String(fileId) } })
						}
					/>
				</div>
			</Drawer>

			<DeleteFilesModal
				open={confirmingDelete}
				files={chosen}
				onClose={() => setConfirmingDelete(false)}
				onDeleted={selection.clear}
			/>
		</>
	)
}
