import { useUnit } from 'effector-react'
import type { ReactNode } from 'react'

import { useTranslation } from '@shared/i18n'
import { SelectDropdown } from '@shared/ui'

import { aniListAccountModel } from '@entities/anilist-account'
import { formatProgress, formatScoreValue, nextScore, trackerModel } from '@entities/tracker'
import type { TrackerEntry, TrackerEntryPatch, TrackerMediaType } from '@entities/tracker'

import styles from './EntryEditor.module.scss'
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

export interface EntryEditorProps {
	entry: TrackerEntry
	mediaType: TrackerMediaType
}

export function EntryEditor({ entry, mediaType }: EntryEditorProps) {
	const { t } = useTranslation()
	const account = useUnit(aniListAccountModel.$account)
	const [updating, requestUpdate] = useUnit([trackerModel.$updating, trackerModel.entryUpdateRequested])

	const busy = Boolean(updating[entry.media_ref])
	const scoreFormat = account?.score_format ?? 'POINT_100'
	const total = mediaType === 'anime' ? entry.media.episodes : entry.media.chapters

	const change = (patch: TrackerEntryPatch) => requestUpdate({ mediaRef: entry.media_ref, patch })

	return (
		<div className={styles.editor}>
			<label className={styles.field}>
				<span className={styles.label}>{t('lists.editor.status')}</span>

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
			</label>

			<Stepper
				label={t('lists.editor.score')}
				value={formatScoreValue(entry.score, scoreFormat)}
				disabled={busy}
				disabledDecrement={entry.score <= 0}
				disabledIncrement={entry.score >= 100}
				onDecrement={() => change({ score: nextScore(entry.score, scoreFormat, -1) })}
				onIncrement={() => change({ score: nextScore(entry.score, scoreFormat, 1) })}
			/>

			<Stepper
				label={t(mediaType === 'anime' ? 'lists.editor.episodes' : 'lists.editor.chapters')}
				value={formatProgress(entry.progress, total)}
				disabled={busy}
				disabledDecrement={entry.progress <= 0}
				disabledIncrement={total != null && entry.progress >= total}
				onDecrement={() => change({ progress: entry.progress - 1 })}
				onIncrement={() => change({ progress: entry.progress + 1 })}
			/>

			{mediaType === 'manga' && (
				<Stepper
					label={t('lists.editor.volumes')}
					value={formatProgress(entry.progress_volumes ?? 0, entry.media.volumes)}
					disabled={busy}
					disabledDecrement={(entry.progress_volumes ?? 0) <= 0}
					disabledIncrement={
						entry.media.volumes != null && (entry.progress_volumes ?? 0) >= entry.media.volumes
					}
					onDecrement={() => change({ progress_volumes: (entry.progress_volumes ?? 0) - 1 })}
					onIncrement={() => change({ progress_volumes: (entry.progress_volumes ?? 0) + 1 })}
				/>
			)}

			<Stepper
				label={t('lists.editor.repeat')}
				value={String(entry.repeat)}
				disabled={busy}
				disabledDecrement={entry.repeat <= 0}
				onDecrement={() => change({ repeat: entry.repeat - 1 })}
				onIncrement={() => change({ repeat: entry.repeat + 1 })}
			/>

			{entry.sync_pending && <p className={styles.pending}>{t('lists.pending')}</p>}
		</div>
	)
}

interface StepperProps {
	label: ReactNode
	value: ReactNode
	disabled?: boolean
	disabledDecrement?: boolean
	disabledIncrement?: boolean
	onDecrement: () => void
	onIncrement: () => void
}

function Stepper({
	label,
	value,
	disabled,
	disabledDecrement,
	disabledIncrement,
	onDecrement,
	onIncrement
}: StepperProps) {
	const { t } = useTranslation()

	return (
		<div className={styles.field}>
			<span className={styles.label}>{label}</span>

			<div className={styles.stepper}>
				<button
					type='button'
					className={styles.step}
					disabled={disabled || disabledDecrement}
					aria-label={t('lists.decrement')}
					onClick={onDecrement}
				>
					−
				</button>

				<span className={styles.value}>{value}</span>

				<button
					type='button'
					className={styles.step}
					disabled={disabled || disabledIncrement}
					aria-label={t('lists.increment')}
					onClick={onIncrement}
				>
					+
				</button>
			</div>
		</div>
	)
}
