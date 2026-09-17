import clsx from 'clsx'
import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'
import { DropdownMenu, Icon } from '@shared/ui'
import type { DropdownMenuItem } from '@shared/ui'

import { formatProgress, trackerModel } from '@entities/tracker'
import type { TrackerEntry, TrackerEntryPatch, TrackerMediaType } from '@entities/tracker'

import styles from './EntryMenu.module.scss'
import './model'

type TrackerStatus = NonNullable<TrackerEntryPatch['status']>

const STATUSES: readonly TrackerStatus[] = [
	'CURRENT',
	'PLANNING',
	'COMPLETED',
	'PAUSED',
	'DROPPED',
	'REPEATING'
]

export interface EntryMenuProps {
	entry: TrackerEntry
	mediaType: TrackerMediaType
}

export function EntryMenu({ entry, mediaType }: EntryMenuProps) {
	const { t } = useTranslation()
	const [updating, requestUpdate] = useUnit([trackerModel.$updating, trackerModel.entryUpdateRequested])

	const busy = Boolean(updating[entry.media_ref])
	const total = mediaType === 'anime' ? entry.media.episodes : entry.media.chapters

	const change = (patch: TrackerEntryPatch) => requestUpdate({ mediaRef: entry.media_ref, patch })

	const progressLabel =
		mediaType === 'anime'
			? t('lists.episodes', { progress: formatProgress(entry.progress, total) })
			: t('lists.chapters', { progress: formatProgress(entry.progress, total) })

	const items: DropdownMenuItem[] = [
		{
			id: 'increment',
			label: t('lists.increment'),
			icon: 'common/plus',
			disabled: busy || (total != null && entry.progress >= total),
			onSelect: () => change({ progress: entry.progress + 1 })
		},
		{
			id: 'decrement',
			label: t('lists.decrement'),
			icon: 'common/restore',
			disabled: busy || entry.progress <= 0,
			onSelect: () => change({ progress: entry.progress - 1 })
		},
		...STATUSES.map(status => ({
			id: status,
			label: t(`lists.status.${mediaType}.${status}`),
			checked: status === entry.status,
			disabled: busy || status === entry.status,
			onSelect: () => change({ status })
		}))
	]

	return (
		<DropdownMenu
			label={entry.sync_pending ? `${progressLabel} · ${t('lists.pending')}` : progressLabel}
			items={items}
			trigger={
				<button
					type='button'
					className={clsx(styles.trigger, entry.sync_pending && styles.pending)}
					aria-label={t('lists.menu')}
				>
					<Icon name='common/more-vertical' size={18} />
				</button>
			}
		/>
	)
}
