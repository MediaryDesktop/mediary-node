import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'
import { DatePicker, Drawer, DrawerForm, DrawerSection, RatingStars, Stepper, Textarea } from '@shared/ui'

import { formatProgress, preferredTitle } from '@entities/tracker'

import { rateEntryModel } from '../model/model'

const FINISHED_STATUSES = ['COMPLETED', 'DROPPED', 'REPEATING']
const RAW_PER_STAR_POINT = 10

export function RateEntryDrawer() {
	const { t } = useTranslation()

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
	const total = mediaType === 'manga' ? entry?.media.chapters : entry?.media.episodes
	const finished = entry ? FINISHED_STATUSES.includes(entry.status) : false
	const starsValue = score / RAW_PER_STAR_POINT

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
					<RatingStars
						min={0}
						max={10}
						step={0.1}
						starsCount={10}
						value={starsValue}
						mode='editable'
						starSize={30}
						showValue
						onChange={next => scoreChanged(Math.round(next * RAW_PER_STAR_POINT))}
					/>
				</DrawerSection>

				<DrawerSection
					title={t(mediaType === 'manga' ? 'lists.editor.chapters' : 'lists.editor.episodes')}
					description={t('lists.rateEntry.progressHint')}
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

				<DrawerSection
					title={t(`lists.rateEntry.started.${mediaType}`)}
					description={t('lists.rateEntry.dateHint')}
				>
					<DatePicker value={startedAt} disabled={saving} onChange={startedAtChanged} />
				</DrawerSection>

				<DrawerSection
					title={t(`lists.rateEntry.completed.${mediaType}`)}
					description={
						finished ? t('lists.rateEntry.dateHint') : t('lists.rateEntry.completedLocked')
					}
				>
					<DatePicker
						value={completedAt}
						disabled={saving || !finished}
						onChange={completedAtChanged}
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
