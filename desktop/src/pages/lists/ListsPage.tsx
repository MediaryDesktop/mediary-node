import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useMemo, useState } from 'react'
import { BsFillGrid3X3GapFill } from 'react-icons/bs'

import { useTranslation } from '@shared/i18n'
import {
	Button,
	EmptyState,
	Icon,
	Input,
	PageHeader,
	PageTransition,
	PhaseTransition,
	SegmentedControl
} from '@shared/ui'

import { useNodeData } from '@infra/node'

import { manualTitlesQuery } from '@entities/media'
import { LIST_MEDIA_TYPES, MediaTypeIcon, trackerListsQuery } from '@entities/tracker'

import { ListOptionsMenu, manageListsModel } from '@features/manage-lists'

import { listsPhase, myTitlesCard, visibleLists } from './lib/lists-view'
import type { ListsFilter } from './lib/lists-view'
import styles from './ListsPage.module.scss'
import { ListCard } from './ui/list-card/ListCard'

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
	const [section, setSection] = useState<'myList' | 'title' | 'fixMatches'>('myList')

	const manual = useUnit(manualTitlesQuery.$data)

	useNodeData(trackerListsQuery)
	useNodeData(manualTitlesQuery)

	const allLists = useMemo(() => lists?.lists ?? [], [lists])

	const visible = useMemo(
		() => visibleLists(allLists, { filter, search, sort: 'recent' }),
		[allLists, filter, search]
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

	const summary = t('lists.listCount', { count: allLists.length })

	const typeItems = [
		{
			value: 'all' as const,
			label: <BsFillGrid3X3GapFill size={18} />,
			ariaLabel: t('lists.filterAll')
		},
		...LIST_MEDIA_TYPES.map(type => ({
			value: type,
			label: <MediaTypeIcon type={type} size={26} />,
			ariaLabel: t(`lists.mediaType.${type}`)
		}))
	]

	return (
		<PageTransition className={styles.root}>
			<PageHeader
				title={t('lists.pageTitle')}
				subtitle={summary}
				tabs={[
					{
						key: 'myList',
						label: t('lists.tabs.myList'),
						active: section === 'myList',
						onSelect: () => setSection('myList')
					},
					{
						key: 'title',
						label: t('lists.tabs.title'),
						active: section === 'title',
						onSelect: () => setSection('title')
					},
					{
						key: 'fixMatches',
						label: t('lists.tabs.fixMatches'),
						active: section === 'fixMatches',
						onSelect: () => setSection('fixMatches')
					}
				]}
			/>

			{section !== 'myList' && <EmptyState title={t('lists.tabs.comingSoon')} />}

			{section === 'myList' && (
				<section className={styles.section}>
					<div className={styles.toolbar}>
						<Input
							value={search}
							onChange={event => setSearch(event.target.value)}
							placeholder={t('lists.search')}
							startIcon={<Icon name='common/search' size={22} />}
							className={styles.search}
						/>

						<SegmentedControl
							size='large'
							items={typeItems}
							value={filter}
							onValueChange={setFilter}
							label={t('lists.yours')}
							className={styles.types}
						/>

						<Button
							variant='primary'
							startIcon={<Icon name='common/plus' size={16} />}
							onClick={() => createRequested()}
							className={styles.create}
						>
							{t('lists.manage.new')}
						</Button>
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
							<div className={styles.grid}>
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
			)}
		</PageTransition>
	)
}
