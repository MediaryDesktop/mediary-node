import { useNavigate } from '@tanstack/react-router'
import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useMemo, useState } from 'react'
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

import { useNodeData } from '@infra/node'

import { manualTitlesQuery } from '@entities/media'
import { LIST_MEDIA_TYPES, listTitleCount, MediaTypeIcon, trackerListsQuery } from '@entities/tracker'

import { ListOptionsMenu, manageListsModel } from '@features/manage-lists'

import { LIST_SORTS, listsPhase, myTitlesCard, visibleLists } from './lib/lists-view'
import type { ListsFilter, ListsSort } from './lib/lists-view'
import styles from './ListsPage.module.scss'
import { ListCard } from './ui/list-card/ListCard'

type View = 'grid' | 'rows'

const VIEWS: readonly View[] = ['grid', 'rows']

const VIEW_ICONS: Record<View, IconLike> = {
	grid: <CiGrid41 size={20} />,
	rows: <CiGrid2H size={20} />
}

export function ListsPage() {
	const { t } = useTranslation()
	const navigate = useNavigate()

	const [lists, listsPending, listsError, startLists] = useUnit([
		trackerListsQuery.$data,
		trackerListsQuery.$pending,
		trackerListsQuery.$error,
		trackerListsQuery.start
	])

	const createRequested = useUnit(manageListsModel.createRequested)

	const [filter, setFilter] = useState<ListsFilter>('all')
	const [search, setSearch] = useState('')
	const [sort, setSort] = useState<ListsSort>('recent')
	const [view, setView] = useState<View>('grid')

	const manual = useUnit(manualTitlesQuery.$data)

	useNodeData(trackerListsQuery)
	useNodeData(manualTitlesQuery)

	const allLists = useMemo(() => lists?.lists ?? [], [lists])

	const visible = useMemo(
		() => visibleLists(allLists, { filter, search, sort }),
		[allLists, filter, search, sort]
	)

	const myTitles = useMemo(
		() => myTitlesCard(manual?.titles ?? [], { filter, search, name: t('lists.myTitles.name') }),
		[manual, filter, search, t]
	)

	const phase = listsPhase({
		shown: visible.length > 0 || myTitles !== null,
		known: allLists.length > 0,
		pending: listsPending,
		failed: Boolean(listsError)
	})

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
							onChange={next => setSort((next as ListsSort) ?? 'recent')}
							options={LIST_SORTS.map(key => ({
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
							{myTitles && (
								<ListCard
									name={myTitles.name}
									count={myTitles.count}
									covers={myTitles.covers}
									badge={
										<>
											<Icon name='common/wand-sparkles' size={18} />
											{t('lists.myTitles.badge')}
										</>
									}
									view={view}
									onOpen={() => navigate({ to: '/lists/my-titles' })}
								/>
							)}

							{visible.map(list => (
								<ListCard
									key={list.id}
									name={list.name}
									count={list.count}
									covers={list.covers ?? []}
									updatedAt={list.updated_at}
									badge={
										<>
											<MediaTypeIcon type={list.media_type} size={18} />
											{t(`lists.mediaType.${list.media_type}`)}
										</>
									}
									menu={<ListOptionsMenu list={list} />}
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
