import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useEffect, useMemo, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { EmptyState, Icon, Input, PageHeader, PageTransition, SegmentedControl } from '@shared/ui'

import {
	deleteLibraryFileMutation,
	libraryRootsQuery,
	libraryTreeQuery,
	setLibraryFileIgnoredMutation
} from '@entities/library-item'
import type { LibraryFile } from '@entities/library-item'

import { MatchFileDrawer, matchFileModel } from '@features/match-library-file'

import { DetailPanel } from './DetailPanel'
import { ExplorerRow } from './ExplorerRow'
import { buildTree, EXPLORER_FILTERS, flattenTree, matchesFilter, matchesSearch } from './lib/build-tree'
import type { ExplorerFilter, FlatNode, TreeNode } from './lib/build-tree'
import styles from './LibraryExplorerPage.module.scss'

export function LibraryExplorerPage() {
	const { t } = useTranslation()
	const navigate = useNavigate()

	const [treeData, treePending, startTree] = useUnit([
		libraryTreeQuery.$data,
		libraryTreeQuery.$pending,
		libraryTreeQuery.start
	])

	const [rootsData, startRoots] = useUnit([libraryRootsQuery.$data, libraryRootsQuery.start])

	const matchRequested = useUnit(matchFileModel.requested)
	const ignoreRequested = useUnit(setLibraryFileIgnoredMutation.start)
	const deleteRequested = useUnit(deleteLibraryFileMutation.start)

	const [filter, setFilter] = useState<ExplorerFilter>('all')
	const [search, setSearch] = useState('')
	const [expanded, setExpanded] = useState<Set<string>>(new Set())
	const [selected, setSelected] = useState<TreeNode | null>(null)

	useEffect(() => {
		startTree()
		startRoots()
	}, [startTree, startRoots])

	const files = useMemo(() => treeData?.files.items ?? [], [treeData])
	const titles = useMemo(() => treeData?.files.titles ?? [], [treeData])
	const roots = useMemo(() => rootsData?.roots ?? [], [rootsData])

	const tree = useMemo(() => {
		const needle = search.trim().toLowerCase()

		const visible = files.filter(file => matchesFilter(file, filter) && matchesSearch(file, needle))

		return buildTree(visible, roots)
	}, [files, roots, filter, search])

	// A search that narrows the library to a handful of files is useless behind
	// closed folders, so filtering opens everything it kept.
	const narrowed = filter !== 'all' || search.trim() !== ''

	const rows = useMemo(() => {
		if (!narrowed) {
			return flattenTree(tree, expanded)
		}

		return flattenTree(tree, allKeysOf(tree))
	}, [tree, expanded, narrowed])

	const toggle = (key: string) =>
		setExpanded(current => {
			const next = new Set(current)

			if (!next.delete(key)) {
				next.add(key)
			}

			return next
		})

	const select = (row: FlatNode) => setSelected(row.node)

	return (
		<PageTransition className={styles.root}>
			<PageHeader
				title={t('library.explorer.title')}
				icon={<Icon name='common/folder-open' size={24} />}
				subtitle={t('library.explorer.description')}
				onBack={() => navigate({ to: '/library' })}
			/>

			<div className={styles.toolbar}>
				<Input
					value={search}
					onChange={event => setSearch(event.target.value)}
					placeholder={t('library.explorer.search')}
					startIcon={<Icon name='common/search' size={16} />}
					className={styles.search}
				/>

				<SegmentedControl
					items={EXPLORER_FILTERS.map(mode => ({
						value: mode,
						label: t(`library.explorer.filter.${mode}`)
					}))}
					value={filter}
					onValueChange={setFilter}
				/>
			</div>

			<div className={styles.layout}>
				<div className={styles.tree}>
					{rows.length > 0
						? rows.map(row => (
								<ExplorerRow
									key={row.node.key}
									row={row}
									expanded={narrowed || expanded.has(row.node.key)}
									selected={selected?.key === row.node.key}
									onToggle={toggle}
									onSelect={select}
								/>
							))
						: !treePending && <EmptyState size='small' title={t('library.explorer.nothing')} />}
				</div>

				<DetailPanel
					node={selected}
					titles={titles}
					onMatch={file => matchRequested(file)}
					onIgnore={(file: LibraryFile, ignored: boolean) =>
						ignoreRequested({ fileId: file.id, ignored })
					}
					onDelete={file => deleteRequested(file.id)}
				/>
			</div>

			<MatchFileDrawer />
		</PageTransition>
	)
}

function allKeysOf(nodes: TreeNode[]): Set<string> {
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
