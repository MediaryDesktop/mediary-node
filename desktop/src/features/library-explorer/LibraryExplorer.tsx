import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useEffect, useMemo, useState } from 'react'
import { FaFilter } from 'react-icons/fa6'
import { LuFolderSync } from 'react-icons/lu'

import { useTranslation } from '@shared/i18n'
import { Button, Drawer, DropdownMenu, EmptyState, Icon, Input, Modal } from '@shared/ui'
import type { CheckboxState } from '@shared/ui'

import {
	deleteLibraryFilesMutation,
	deleteLibraryMatchesMutation,
	isMatched,
	libraryRootsQuery,
	libraryTreeQuery,
	setLibraryFilesIgnoredMutation
} from '@entities/library-item'
import type { LibraryFile } from '@entities/library-item'

import { DetailPanel } from './ui/detail-panel/DetailPanel'
import { ExplorerRow } from './ui/explorer-row/ExplorerRow'
import { buildTree, EXPLORER_FILTERS, flattenTree, matchesFilter, matchesSearch } from './lib/build-tree'
import type { ExplorerFilter, FlatNode, TreeFolder, TreeNode } from './lib/build-tree'
import styles from './LibraryExplorer.module.scss'
import { libraryExplorerModel } from './model/model'

export interface LibraryExplorerProps {
	// Matching lives in its own slice; the page that mounts the explorer hands
	// this in rather than the two features reaching into each other.
	onMatchMany: (files: LibraryFile[]) => void
}

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

	const [unmatchFiles, ignoreFiles, deleteFiles, deleting] = useUnit([
		deleteLibraryMatchesMutation.start,
		setLibraryFilesIgnoredMutation.start,
		deleteLibraryFilesMutation.start,
		deleteLibraryFilesMutation.$pending
	])

	const [filter, setFilter] = useState<ExplorerFilter | null>(null)
	const [expanded, setExpanded] = useState<Set<string>>(new Set())
	const [focused, setFocused] = useState<TreeNode | null>(null)
	const [selecting, setSelecting] = useState(false)
	const [selected, setSelected] = useState<Set<number>>(new Set())
	const [confirmingDelete, setConfirmingDelete] = useState(false)

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

	const chosen = useMemo(() => files.filter(file => selected.has(file.id)), [files, selected])

	const allMatched = chosen.length > 0 && chosen.every(isMatched)
	const allIgnored = chosen.length > 0 && chosen.every(file => file.ignored)

	const clearSelection = () => setSelected(new Set())

	const toggleFolder = (key: string) =>
		setExpanded(current => {
			const next = new Set(current)

			if (!next.delete(key)) {
				next.add(key)
			}

			return next
		})

	const check = (row: FlatNode, checked: boolean) =>
		setSelected(current => {
			const next = new Set(current)
			const ids = row.node.kind === 'file' ? [row.node.file.id] : fileIdsUnder(row.node)

			for (const id of ids) {
				if (checked) {
					next.add(id)
				} else {
					next.delete(id)
				}
			}

			return next
		})

	const checkedOf = (node: TreeNode): CheckboxState => {
		if (node.kind === 'file') {
			return selected.has(node.file.id)
		}

		const ids = fileIdsUnder(node)
		const picked = ids.filter(id => selected.has(id)).length

		return picked === 0 ? false : picked === ids.length ? true : 'mixed'
	}

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
					<div className={styles.toolbar}>
						{unmatchedCount > 0 && (
							<button
								type='button'
								className={styles.pill}
								onClick={() => setFilter('unmatched')}
							>
								<Icon name='common/info' size={14} />
								{t('library.explorer.unmatchedPill', { count: unmatchedCount })}
							</button>
						)}

						<span className={styles.spacer} />

						{selecting && chosen.length > 0 && (
							<>
								<Button
									variant='ghost'
									size='small'
									startIcon={<Icon name='common/link' size={16} />}
									className={allMatched ? styles.warning : styles.success}
									onClick={() => {
										if (allMatched) {
											unmatchFiles(chosen.map(file => file.id))
										} else {
											onMatchMany(chosen)
										}

										clearSelection()
									}}
								>
									{allMatched
										? t('library.explorer.unmatchFiles', { count: chosen.length })
										: t('library.explorer.matchFiles', { count: chosen.length })}
								</Button>

								<Button
									variant='ghost'
									size='small'
									startIcon={
										<Icon name={allIgnored ? 'common/eye' : 'common/eye-off'} size={16} />
									}
									onClick={() => {
										ignoreFiles(
											chosen.map(file => ({ fileId: file.id, ignored: !allIgnored }))
										)
										clearSelection()
									}}
								>
									{allIgnored
										? t('library.explorer.unignoreFiles', { count: chosen.length })
										: t('library.explorer.ignoreFiles', { count: chosen.length })}
								</Button>

								<Button
									variant='secondary'
									size='small'
									startIcon={<Icon name='common/trash' size={16} />}
									className={styles.danger}
									onClick={() => setConfirmingDelete(true)}
								>
									{t('library.explorer.deleteFiles', { count: chosen.length })}
								</Button>
							</>
						)}

						{filter === null ? (
							<DropdownMenu
								align='end'
								items={EXPLORER_FILTERS.map(preset => ({
									id: preset,
									label: t(`library.explorer.filter.${preset}`),
									onSelect: () => setFilter(preset)
								}))}
								trigger={
									<Button
										variant='secondary'
										size='small'
										startIcon={<FaFilter size={16} />}
									>
										{t('library.explorer.filterAction')}
									</Button>
								}
							/>
						) : (
							<Button
								variant='primary'
								size='small'
								startIcon={<Icon name='common/close' size={16} />}
								className={styles.pulse}
								onClick={() => setFilter(null)}
							>
								{t('library.explorer.filterActive', {
									filter: t(`library.explorer.filter.${filter}`)
								})}
							</Button>
						)}

						<Button
							variant={selecting ? 'primary' : 'secondary'}
							size='small'
							startIcon={<Icon name='common/list-checks' size={16} />}
							className={selecting ? styles.pulse : undefined}
							onClick={() => {
								setSelecting(current => !current)
								clearSelection()
							}}
						>
							{selecting ? t('library.explorer.selecting') : t('library.explorer.select')}
						</Button>

						<Button
							variant='secondary'
							size='small'
							iconOnly
							loading={treePending}
							aria-label={t('library.explorer.refresh')}
							onClick={() => startTree()}
						>
							<LuFolderSync size={16} />
						</Button>
					</div>
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
											checked={selecting ? checkedOf(row.node) : false}
											title={
												row.node.kind === 'file' && row.node.file.match
													? titleByRef.get(row.node.file.match.media_ref)
													: undefined
											}
											onToggle={toggleFolder}
											onFocus={next => setFocused(next.node)}
											onCheck={check}
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

			<Modal
				open={confirmingDelete}
				onOpenChange={next => !next && setConfirmingDelete(false)}
				title={t('library.explorer.deleteTitle', { count: chosen.length })}
				description={t('library.file.deleteFileWarning')}
				size='sm'
				footer={
					<>
						<Button
							variant='secondary'
							disabled={deleting}
							onClick={() => setConfirmingDelete(false)}
						>
							{t('common.cancel')}
						</Button>

						<Button
							variant='primary'
							loading={deleting}
							onClick={() => {
								deleteFiles(chosen.map(file => file.id))
								setConfirmingDelete(false)
								clearSelection()
							}}
						>
							{t('library.explorer.deleteFiles', { count: chosen.length })}
						</Button>
					</>
				}
			>
				<ul className={styles.deleteList}>
					{chosen.slice(0, 8).map(file => (
						<li key={file.id}>{file.rel_path}</li>
					))}
					{chosen.length > 8 && (
						<li>{t('library.explorer.andMore', { count: chosen.length - 8 })}</li>
					)}
				</ul>
			</Modal>
		</>
	)
}

function fileIdsUnder(folder: TreeFolder): number[] {
	const ids: number[] = []

	for (const child of folder.children) {
		if (child.kind === 'file') {
			ids.push(child.file.id)
		} else {
			ids.push(...fileIdsUnder(child))
		}
	}

	return ids
}

function allFolderKeys(nodes: TreeNode[]): Set<string> {
	const keys = new Set<string>()

	const walk = (list: TreeNode[]) => {
		for (const node of list) {
			if (node.kind === 'folder') {
				keys.add(node.key)
				walk(node.children)
			}
		}
	}

	walk(nodes)

	return keys
}
