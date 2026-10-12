import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useEffect, useMemo, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { EmptyState, PageHeader, PageTransition, PhaseTransition } from '@shared/ui'

import { aniListAccountModel } from '@entities/anilist-account'
import { MediaCard } from '@entities/media'
import {
	entryTracking,
	isTrackerMediaType,
	ListIcon,
	preferredTitle,
	trackerListsQuery,
	useTrackedEntries
} from '@entities/tracker'
import type { TrackerCustomList, TrackerEntry, TrackerMediaType } from '@entities/tracker'

import { ListOptionsMenu, manageListsModel } from '@features/manage-lists'
import { EntryMenu } from '@features/track-media'

import { applyEntryFilters, formatsOf, genresOf, INITIAL_ENTRY_FILTERS } from './lib/entry-filters'
import styles from './ListDetailPage.module.scss'
import { ListFilters } from './ui/list-filters/ListFilters'

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

		if (!list) {
			return []
		}

		return tracked.filter(
			entry => entry.media_type === list.media_type && entry.custom_lists?.includes(list.name)
		)
	}, [status, list, tracked])

	const listType = list?.media_type ?? entries[0]?.media_type
	const mediaType: TrackerMediaType = listType && isTrackerMediaType(listType) ? listType : 'anime'

	const formats = useMemo(() => formatsOf(entries), [entries])
	const genres = useMemo(() => genresOf(entries), [entries])
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
					icon={<ListIcon icon={list?.icon} mediaType={list?.media_type} size={24} />}
					subtitle={subtitle}
					breadcrumbs={[
						{ label: t('nav.lists'), onSelect: () => navigate({ to: '/lists' }) },
						{ label: title }
					]}
					rightContent={list && <ListOptionsMenu list={list} />}
				/>

				{entries.length > 0 && (
					<ListFilters
						filters={filters}
						formats={formats}
						genres={genres}
						mediaType={mediaType}
						onChange={setFilters}
					/>
				)}

				<PhaseTransition phase={visible.length === 0 ? 'empty' : 'entries'}>
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
										scoreBadge={entry.media.average_score ?? undefined}
										tracking={entryTracking(entry, t)}
										menu={
											<EntryMenu
												media={{
													mediaRef: entry.media_ref,
													mediaType: entry.media_type as TrackerMediaType,
													title: preferredTitle(entry.media.title),
													siteUrl: entry.media.site_url
												}}
												entry={entry}
												listName={
													list?.provider === 'anilist' ? list.name : undefined
												}
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
				</PhaseTransition>
			</PageTransition>
		</>
	)
}
