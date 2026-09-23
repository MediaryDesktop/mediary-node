import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'
import { Drawer, DrawerForm, DrawerSection, Input, Stepper, Textarea } from '@shared/ui'

import { aniListAccountModel } from '@entities/anilist-account'
import { formatProgress, formatScoreValue, nextScore, preferredTitle } from '@entities/tracker'

import { rateEntryModel } from '../model/model'

const FINISHED_STATUSES = ['COMPLETED', 'DROPPED', 'REPEATING']

export function RateEntryDrawer() {
	const { t } = useTranslation()
	const account = useUnit(aniListAccountModel.$account)

	const [open, target, score, notes, startedAt, completedAt, repeat, progress, volumes] = useUnit([
		rateEntryModel.$open,
		rateEntryModel.$target,
		rateEntryModel.$score,
		rateEntryModel.$notes,
		rateEntryModel.$startedAt,
		rateEntryModel.$completedAt,
		rateEntryModel.$repeat,
		rateEntryModel.$progress,
		rateEntryModel.$volumes
	])

	const [dirty, saving, closed, submitted] = useUnit([
		rateEntryModel.$dirty,
		rateEntryModel.$saving,
		rateEntryModel.closed,
		rateEntryModel.submitted
	])

	const [scoreChanged, notesChanged, startedAtChanged, completedAtChanged] = useUnit([
		rateEntryModel.scoreChanged,
		rateEntryModel.notesChanged,
		rateEntryModel.startedAtChanged,
		rateEntryModel.completedAtChanged
	])

	const [repeatChanged, progressChanged, volumesChanged] = useUnit([
		rateEntryModel.repeatChanged,
		rateEntryModel.progressChanged,
		rateEntryModel.volumesChanged
	])

	const entry = target?.entry
	const mediaType = target?.mediaType ?? 'anime'
	const scoreFormat = account?.score_format ?? 'POINT_100'
	const total = mediaType === 'anime' ? entry?.media.episodes : entry?.media.chapters
	const finished = entry ? FINISHED_STATUSES.includes(entry.status) : false

	return (
		<Drawer
			open={open}
			onOpenChange={next => !next && closed()}
			title={t('lists.rateEntry.title')}
			description={entry ? preferredTitle(entry.media.title) : undefined}
			closable={false}
		>
			<DrawerForm
				onSubmit={submitted}
				onCancel={closed}
				submitLabel={t('lists.manageEntry.save')}
				submitDisabled={!dirty || saving}
				cancelDisabled={saving}
				submitting={saving}
			>
				<DrawerSection title={t('lists.editor.score')} description={t('lists.rateEntry.scoreHint')}>
					<Stepper
						value={formatScoreValue(score, scoreFormat)}
						disabled={saving}
						decrementDisabled={score <= 0}
						incrementDisabled={score >= 100}
						onDecrement={() => scoreChanged(nextScore(score, scoreFormat, -1))}
						onIncrement={() => scoreChanged(nextScore(score, scoreFormat, 1))}
					/>
				</DrawerSection>

				<DrawerSection
					title={t(mediaType === 'anime' ? 'lists.editor.episodes' : 'lists.editor.chapters')}
				>
					<Stepper
						value={formatProgress(progress, total)}
						disabled={saving}
						decrementDisabled={progress <= 0}
						incrementDisabled={total != null && progress >= total}
						onDecrement={() => progressChanged(progress - 1)}
						onIncrement={() => progressChanged(progress + 1)}
					/>
				</DrawerSection>

				{mediaType === 'manga' && (
					<DrawerSection title={t('lists.editor.volumes')}>
						<Stepper
							value={formatProgress(volumes, entry?.media.volumes)}
							disabled={saving}
							decrementDisabled={volumes <= 0}
							incrementDisabled={entry?.media.volumes != null && volumes >= entry.media.volumes}
							onDecrement={() => volumesChanged(volumes - 1)}
							onIncrement={() => volumesChanged(volumes + 1)}
						/>
					</DrawerSection>
				)}

				<DrawerSection title={t('lists.editor.repeat')} description={t('lists.rateEntry.repeatHint')}>
					<Stepper
						value={String(repeat)}
						disabled={saving}
						decrementDisabled={repeat <= 0}
						onDecrement={() => repeatChanged(repeat - 1)}
						onIncrement={() => repeatChanged(repeat + 1)}
					/>
				</DrawerSection>

				<DrawerSection title={t('lists.rateEntry.started')}>
					<Input
						type='date'
						value={startedAt}
						disabled={saving}
						onChange={event => startedAtChanged(event.target.value)}
					/>
				</DrawerSection>

				<DrawerSection
					title={t('lists.rateEntry.completed')}
					description={finished ? undefined : t('lists.rateEntry.completedLocked')}
				>
					<Input
						type='date'
						value={completedAt}
						disabled={saving || !finished}
						onChange={event => completedAtChanged(event.target.value)}
					/>
				</DrawerSection>

				<DrawerSection
					title={t('lists.rateEntry.notes')}
					description={t('lists.rateEntry.notesHint')}
				>
					<Textarea
						value={notes}
						disabled={saving}
						rows={5}
						maxLength={10000}
						placeholder={t('lists.rateEntry.notesPlaceholder')}
						onChange={event => notesChanged(event.target.value)}
					/>
				</DrawerSection>
			</DrawerForm>
		</Drawer>
	)
}
