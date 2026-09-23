import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useEffect, useMemo, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { EmptyState, PageHeader, PageTransition } from '@shared/ui'

import { aniListAccountModel } from '@entities/anilist-account'
import { MediaCard } from '@entities/media'
import { trackerListsQuery, useTrackedEntries } from '@entities/tracker'
import type { TrackerCustomList, TrackerEntry, TrackerMediaType } from '@entities/tracker'

import { DeleteListDialog, ListDrawer, ListOptionsMenu, manageListsModel } from '@features/manage-lists'
import { EntryMenu } from '@features/track-media'

import { applyEntryFilters, formatsOf, INITIAL_ENTRY_FILTERS } from './lib/entry-filters'
import { ListFilters } from './list-filters/ListFilters'
import styles from './ListDetailPage.module.scss'

const STATUS_PREFIX = 'status:'

const STATUS_LABELS = {
	PLANNING: 'lists.shortcut.watchlist',
	COMPLETED: 'lists.shortcut.completed',
	CURRENT: 'lists.shortcut.current'
} as const

type PinnedStatus = keyof typeof STATUS_LABELS

function pinnedStatusOf(listId: string): PinnedStatus | null {
	if (!listId.startsWith(STATUS_PREFIX)) {
		return null
	}

	const status = listId.slice(STATUS_PREFIX.length)

	return status in STATUS_LABELS ? (status as PinnedStatus) : null
}

export interface ListDetailPageProps {
	listId: string
}

export function ListDetailPage({ listId }: ListDetailPageProps) {
	const { t } = useTranslation()
	const navigate = useNavigate()

	const [lists, startLists, connected, deleted, deletionHandled] = useUnit([
		trackerListsQuery.$data,
		trackerListsQuery.start,
		aniListAccountModel.$connected,
		manageListsModel.$deleted,
		manageListsModel.deletionHandled
	])

	const leaving = deleted === listId

	const tracked = useTrackedEntries(connected)

	useEffect(() => {
		startLists()
	}, [startLists])

	const [filters, setFilters] = useState(INITIAL_ENTRY_FILTERS)

	const status = pinnedStatusOf(listId)

	const list = useMemo<TrackerCustomList | null>(
		() => (status ? null : ((lists?.lists ?? []).find(candidate => candidate.id === listId) ?? null)),
		[lists, listId, status]
	)

	const entries = useMemo<TrackerEntry[]>(() => {
		if (status) {
			return tracked.filter(entry => entry.status === status)
		}

		if (!list || list.provider !== 'anilist') {
			return []
		}

		return tracked.filter(
			entry => entry.media_type === list.media_type && entry.custom_lists?.includes(list.name)
		)
	}, [status, list, tracked])

	const mediaType: TrackerMediaType =
		list?.media_type === 'manga' || entries[0]?.media_type === 'manga' ? 'manga' : 'anime'

	const formats = useMemo(() => formatsOf(entries), [entries])
	const visible = useMemo(() => applyEntryFilters(entries, filters), [entries, filters])

	const title = status ? t(STATUS_LABELS[status]) : (list?.name ?? t('nav.lists'))

	const subtitle = status
		? t('lists.titleCount', { count: entries.length })
		: list
			? `${t(`lists.mediaType.${list.media_type}`)} · ${t('lists.titleCount', { count: list.count })}`
			: null

	return (
		<>
			<PageTransition
				className={styles.root}
				leaving={leaving}
				onLeft={() => {
					deletionHandled()
					navigate({ to: '/lists' })
				}}
			>
				<PageHeader
					title={title}
					subtitle={subtitle}
					onBack={() => navigate({ to: '/lists' })}
					rightContent={list && <ListOptionsMenu list={list} />}
				/>

				{entries.length > 0 && (
					<ListFilters
						filters={filters}
						formats={formats}
						mediaType={mediaType}
						onChange={setFilters}
					/>
				)}

				{visible.length === 0 ? (
					<EmptyState
						title={entries.length === 0 ? t('lists.empty') : t('lists.filters.noMatches')}
					/>
				) : (
					<ul className={styles.grid}>
						{visible.map(entry => (
							<li key={entry.media_ref}>
								<MediaCard
									media={entry.media}
									scoreBadge={entry.score > 0 ? entry.score : undefined}
									menu={
										<EntryMenu
											entry={entry}
											mediaType={entry.media_type as TrackerMediaType}
											listName={list?.provider === 'anilist' ? list.name : undefined}
										/>
									}
									previewRef={entry.media_ref}
									onOpen={() =>
										navigate({
											to: '/media/$mediaRef',
											params: { mediaRef: entry.media_ref }
										})
									}
								/>
							</li>
						))}
					</ul>
				)}
			</PageTransition>

			<ListDrawer />
			<DeleteListDialog />
		</>
	)
}
