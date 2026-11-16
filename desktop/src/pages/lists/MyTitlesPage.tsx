import { useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import {
	EmptyState,
	Icon,
	LoadFailed,
	PageHeader,
	PageTransition,
	PhaseTransition,
	SelectionGroup
} from '@shared/ui'

import { useNodeQuery } from '@infra/node'

import { manualTitlesQuery, MediaCard } from '@entities/media'
import { LIST_MEDIA_TYPES, MediaTypeIcon } from '@entities/tracker'
import type { ListMediaType } from '@entities/tracker'

import styles from './ListDetailPage.module.scss'

type Filter = ListMediaType | 'all'

export function MyTitlesPage() {
	const { t } = useTranslation()
	const navigate = useNavigate()

	const state = useNodeQuery(manualTitlesQuery)
	const titles = useMemo(() => state.data?.titles ?? [], [state.data])

	const [filter, setFilter] = useState<Filter>('all')

	const kinds = LIST_MEDIA_TYPES.filter(type => titles.some(title => title.media_type === type))
	const visible = filter === 'all' ? titles : titles.filter(title => title.media_type === filter)

	const name = t('lists.myTitles.name')

	const typeOptions = [
		{ value: 'all' as const, label: t('lists.filterAll') },
		...kinds.map(type => ({
			value: type,
			label: t(`lists.mediaType.${type}`),
			icon: <MediaTypeIcon type={type} size={20} />
		}))
	]

	const phase =
		state.phase === 'failed' && titles.length === 0
			? 'failed'
			: visible.length > 0
				? 'titles'
				: state.data
					? 'empty'
					: 'loading'

	return (
		<PageTransition className={styles.root}>
			<PageHeader
				title={name}
				icon={<Icon name='common/wand-sparkles' size={24} />}
				subtitle={t('lists.titleCount', { count: titles.length })}
				breadcrumbs={[
					{ label: t('nav.lists'), onSelect: () => navigate({ to: '/lists' }) },
					{ label: name }
				]}
			/>

			{kinds.length > 1 && (
				<SelectionGroup
					options={typeOptions}
					value={kinds.includes(filter as ListMediaType) ? filter : 'all'}
					onValueChange={setFilter}
					label={name}
				/>
			)}

			<PhaseTransition phase={phase}>
				{phase === 'failed' && <LoadFailed onRetry={state.retry} />}

				{phase === 'empty' && (
					<EmptyState
						title={t('lists.myTitles.empty')}
						description={t('lists.myTitles.emptyHint')}
					/>
				)}

				{phase === 'titles' && (
					<ul className={styles.grid}>
						{visible.map(title => (
							<li key={title.media_ref}>
								<MediaCard
									media={title}
									previewRef={title.media_ref}
									onOpen={() =>
										navigate({
											to: '/media/$mediaRef',
											params: { mediaRef: title.media_ref }
										})
									}
								/>
							</li>
						))}
					</ul>
				)}
			</PhaseTransition>
		</PageTransition>
	)
}
