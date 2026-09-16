import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'
import { SelectDropdown } from '@shared/ui'

import { formatProgress, trackerModel } from '@entities/tracker'
import type { TrackerEntry, TrackerEntryPatch, TrackerMediaType } from '@entities/tracker'

import styles from './EntryControls.module.scss'
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

function isStatus(value: string): value is TrackerStatus {
	return (STATUSES as readonly string[]).includes(value)
}

export interface EntryControlsProps {
	entry: TrackerEntry
	mediaType: TrackerMediaType
}

export function EntryControls({ entry, mediaType }: EntryControlsProps) {
	const { t } = useTranslation()
	const [updating, requestUpdate] = useUnit([trackerModel.$updating, trackerModel.entryUpdateRequested])

	const busy = Boolean(updating[entry.media_ref])
	const total = mediaType === 'anime' ? entry.media.episodes : entry.media.chapters

	const change = (patch: TrackerEntryPatch) => requestUpdate({ mediaRef: entry.media_ref, patch })

	const progressLabel =
		mediaType === 'anime'
			? t('lists.episodes', { progress: formatProgress(entry.progress, total) })
			: t('lists.chapters', { progress: formatProgress(entry.progress, total) })

	return (
		<div className={styles.controls}>
			<SelectDropdown
				value={entry.status}
				disabled={busy}
				options={STATUSES.map(status => ({
					value: status,
					label: t(`lists.status.${mediaType}.${status}`)
				}))}
				onChange={value => {
					if (value && value !== entry.status && isStatus(value)) {
						change({ status: value })
					}
				}}
			/>

			<div className={styles.progress}>
				<button
					type='button'
					className={styles.step}
					disabled={busy || entry.progress <= 0}
					aria-label={t('lists.decrement')}
					onClick={() => change({ progress: entry.progress - 1 })}
				>
					−
				</button>

				<span className={styles.value}>{progressLabel}</span>

				<button
					type='button'
					className={styles.step}
					disabled={busy || (total != null && entry.progress >= total)}
					aria-label={t('lists.increment')}
					onClick={() => change({ progress: entry.progress + 1 })}
				>
					+
				</button>
			</div>

			{entry.sync_pending && <span className={styles.pending}>{t('lists.pending')}</span>}
		</div>
	)
}
