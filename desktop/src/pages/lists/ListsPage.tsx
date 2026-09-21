import { useNavigate } from '@tanstack/react-router'
import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useEffect, useMemo, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import {
	Button,
	Icon,
	Input,
	PageTransition,
	SegmentedControl,
	SelectDropdown,
	SelectionGroup
} from '@shared/ui'
import type { IconName } from '@shared/ui'

import { aniListAccountModel } from '@entities/anilist-account'
import {
	LIST_MEDIA_TYPES,
	listTitleCount,
	MediaTypeIcon,
	trackerListsQuery,
	useTrackedEntries
} from '@entities/tracker'
import type { ListMediaType, TrackerCustomList } from '@entities/tracker'

import { ConnectAniList } from '@features/connect-anilist'
import { ListDrawer, manageListsModel } from '@features/manage-lists'

import { ListCard } from './ListCard'
import styles from './ListsPage.module.scss'
import { PinnedShelf } from './PinnedShelf'

type Filter = ListMediaType | 'all'
type SortKey = 'recent' | 'name' | 'size'
type View = 'grid' | 'rows'

const SORT_KEYS: readonly SortKey[] = ['recent', 'name', 'size']

const VIEWS: readonly View[] = ['grid', 'rows']

const VIEW_ICONS: Record<View, IconName> = {
	grid: 'common/library',
	rows: 'common/list-checks'
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

	const entries = useTrackedEntries(connected)

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

	const openMedia = (mediaRef: string) => navigate({ to: '/media/$mediaRef', params: { mediaRef } })

	return (
		<PageTransition className={styles.root}>
			<header className={styles.header}>
				<div className={styles.heading}>
					<h1 className={styles.title}>{t('nav.lists')}</h1>

					<p className={styles.summary}>{summary.join(' · ')}</p>
				</div>

				<Button
					variant='primary'
					startIcon={<Icon name='common/plus' size={16} />}
					onClick={() => createRequested()}
				>
					{t('lists.manage.new')}
				</Button>
			</header>

			{sessionLoaded && !connected && (
				<section className={styles.connect}>
					<p className={styles.connectText}>{t('lists.connect')}</p>
					<ConnectAniList />
				</section>
			)}

			{connected && entries.length > 0 && (
				<PinnedShelf
					entries={entries}
					onOpen={openMedia}
					onOpenStatus={status =>
						navigate({ to: '/lists/$listId', params: { listId: `status:${status}` } })
					}
				/>
			)}

			<section className={styles.section}>
				<div className={styles.toolbar}>
					<div className={styles.top}>
						<Input
							value={search}
							onChange={event => setSearch(event.target.value)}
							placeholder={t('lists.search')}
							startIcon={<Icon name='common/search' size={16} />}
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
								label: <Icon name={VIEW_ICONS[mode]} size={16} />,
								ariaLabel: t(`lists.view.${mode}`)
							}))}
							value={view}
							onValueChange={setView}
						/>
					</div>
				</div>

				{listsPending && allLists.length === 0 && (
					<p className={styles.muted}>{t('lists.loading')}</p>
				)}

				{listsError && allLists.length === 0 && (
					<div className={styles.failure}>
						<p className={styles.muted}>{t('lists.failed')}</p>
						<Button size='small' onClick={() => startLists()}>
							{t('lists.retry')}
						</Button>
					</div>
				)}

				<div className={clsx(styles.grid, view === 'rows' && styles.rows)}>
					{visible.map(list => (
						<ListCard
							key={list.id}
							list={list}
							view={view}
							onOpen={() => navigate({ to: '/lists/$listId', params: { listId: list.id } })}
						/>
					))}

					<button type='button' className={styles.newCard} onClick={() => createRequested()}>
						<span className={styles.newIcon}>
							<Icon name='common/plus' size={20} />
						</span>
						<span className={styles.newTitle}>{t('lists.manage.new')}</span>
						<span className={styles.newHint}>{t('lists.manage.newHint')}</span>
					</button>
				</div>

				{!listsPending && visible.length === 0 && (
					<p className={styles.muted}>
						{allLists.length === 0 ? t('lists.noLists') : t('lists.noMatches')}
					</p>
				)}
			</section>

			<ListDrawer />
		</PageTransition>
	)
}
