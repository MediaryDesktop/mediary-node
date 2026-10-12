import { useNavigate } from '@tanstack/react-router'
import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useEffect, useMemo, useState } from 'react'
import { CiGrid2H, CiGrid41 } from 'react-icons/ci'

import { useTranslation } from '@shared/i18n'
import {
	Button,
	EmptyState,
	Icon,
	Input,
	PageHeader,
	PageTransition,
	PhaseTransition,
	renderIcon,
	SegmentedControl,
	SelectDropdown,
	SelectionGroup
} from '@shared/ui'
import type { IconLike } from '@shared/ui'

import { aniListAccountModel } from '@entities/anilist-account'
import { LIST_MEDIA_TYPES, listTitleCount, MediaTypeIcon, trackerListsQuery } from '@entities/tracker'
import type { ListMediaType, TrackerCustomList } from '@entities/tracker'

import { ConnectAniList } from '@features/connect-anilist'
import { manageListsModel } from '@features/manage-lists'

import styles from './ListsPage.module.scss'
import { ListCard } from './ui/list-card/ListCard'

type Filter = ListMediaType | 'all'
type SortKey = 'recent' | 'name' | 'size'
type View = 'grid' | 'rows'

const SORT_KEYS: readonly SortKey[] = ['recent', 'name', 'size']

const VIEWS: readonly View[] = ['grid', 'rows']

const VIEW_ICONS: Record<View, IconLike> = {
	grid: <CiGrid41 size={20} />,
	rows: <CiGrid2H size={20} />
}

function changedAt(list: TrackerCustomList): number {
	return list.updated_at ? Date.parse(list.updated_at) : 0
}

function sortLists(lists: TrackerCustomList[], key: SortKey): TrackerCustomList[] {
	const sorted = lists.slice()

	switch (key) {
		case 'name':
			return sorted.sort((a, b) => a.name.localeCompare(b.name))
		case 'size':
			return sorted.sort((a, b) => b.count - a.count)
		default:
			return sorted.sort((a, b) => changedAt(b) - changedAt(a))
	}
}

export function ListsPage() {
	const { t } = useTranslation()
	const navigate = useNavigate()

	const [connected, sessionLoaded] = useUnit([aniListAccountModel.$connected, aniListAccountModel.$loaded])

	const [lists, listsPending, listsError, startLists] = useUnit([
		trackerListsQuery.$data,
		trackerListsQuery.$pending,
		trackerListsQuery.$error,
		trackerListsQuery.start
	])

	const createRequested = useUnit(manageListsModel.createRequested)

	const [filter, setFilter] = useState<Filter>('all')
	const [search, setSearch] = useState('')
	const [sort, setSort] = useState<SortKey>('recent')
	const [view, setView] = useState<View>('grid')

	useEffect(() => {
		startLists()
	}, [startLists])

	const allLists = useMemo(() => lists?.lists ?? [], [lists])

	const visible = useMemo(() => {
		const needle = search.trim().toLowerCase()

		const matched = allLists.filter(list => {
			const byType = filter === 'all' || list.media_type === filter
			const byName = needle === '' || list.name.toLowerCase().includes(needle)

			return byType && byName
		})

		return sortLists(matched, sort)
	}, [allLists, filter, search, sort])

	const phase =
		visible.length > 0
			? 'lists'
			: listsPending && allLists.length === 0
				? 'loading'
				: listsError && allLists.length === 0
					? 'failed'
					: !listsPending && !listsError
						? 'empty'
						: 'idle'

	const summary = [
		t('lists.listCount', { count: allLists.length }),
		t('lists.titleCount', { count: listTitleCount(allLists) })
	]

	const typeOptions = [
		{ value: 'all' as const, label: t('lists.filterAll') },
		...LIST_MEDIA_TYPES.map(type => ({
			value: type,
			label: t(`lists.mediaType.${type}`),
			icon: <MediaTypeIcon type={type} size={20} />
		}))
	]

	return (
		<PageTransition className={styles.root}>
			<PageHeader
				title={t('nav.lists')}
				icon={<Icon name='common/list' size={24} />}
				subtitle={summary.join(' · ')}
				rightContent={
					<Button
						variant='primary'
						startIcon={<Icon name='common/plus' size={16} />}
						onClick={() => createRequested()}
					>
						{t('lists.manage.new')}
					</Button>
				}
			/>

			{sessionLoaded && !connected && (
				<section className={styles.connect}>
					<p className={styles.connectText}>{t('lists.connect')}</p>
					<ConnectAniList />
				</section>
			)}

			<section className={styles.section}>
				<div className={styles.toolbar}>
					<div className={styles.top}>
						<Input
							value={search}
							onChange={event => setSearch(event.target.value)}
							placeholder={t('lists.search')}
							startIcon={<Icon name='common/search' size={22} />}
							className={styles.search}
						/>

						<SelectDropdown
							value={sort}
							onChange={next => setSort((next as SortKey) ?? 'recent')}
							options={SORT_KEYS.map(key => ({
								value: key,
								label: t(`lists.sort.${key}`)
							}))}
							startIcon={<Icon name='common/sort' size={16} />}
							className={styles.sort}
						/>
					</div>

					<div className={styles.filters}>
						<SelectionGroup
							options={typeOptions}
							value={filter}
							onValueChange={setFilter}
							label={t('lists.yours')}
							className={styles.types}
						/>

						<SegmentedControl
							size='large'
							items={VIEWS.map(mode => ({
								value: mode,
								label: renderIcon(VIEW_ICONS[mode], 16),
								ariaLabel: t(`lists.view.${mode}`)
							}))}
							value={view}
							onValueChange={setView}
						/>
					</div>
				</div>

				<PhaseTransition phase={phase}>
					{phase === 'loading' && <p className={styles.muted}>{t('lists.loading')}</p>}

					{phase === 'failed' && (
						<EmptyState
							title={t('lists.failed')}
							action={
								<Button size='small' onClick={() => startLists()}>
									{t('lists.retry')}
								</Button>
							}
						/>
					)}

					{phase === 'lists' && (
						<div className={clsx(styles.grid, view === 'rows' && styles.rows)}>
							{visible.map(list => (
								<ListCard
									key={list.id}
									list={list}
									view={view}
									onOpen={() =>
										navigate({ to: '/lists/$listId', params: { listId: list.id } })
									}
								/>
							))}
						</div>
					)}

					{phase === 'empty' && (
						<EmptyState
							title={allLists.length === 0 ? t('lists.noLists') : t('lists.noMatches')}
						/>
					)}
				</PhaseTransition>
			</section>
		</PageTransition>
	)
}
