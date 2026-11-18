import type { Unit } from 'effector'

import { useTranslation } from '@shared/i18n'
import { Button, Icon, PageHeader, Textarea } from '@shared/ui'

import type { ManualDraft } from '@entities/media'

import { completeness } from '../../lib/completeness'
import { useManualMediaForm } from '../../lib/useManualMediaForm'
import type { CreatedList } from '../../lib/useManualMediaForm'
import { AIAssistantCard } from '../ai-assistant-card/AIAssistantCard'
import { BasicsTab } from '../basics-tab/BasicsTab'
import { CompletenessCard } from '../completeness-card/CompletenessCard'
import { DeleteManualMediaDialog } from '../delete-manual-media-dialog/DeleteManualMediaDialog'
import { DetailsTab } from '../details-tab/DetailsTab'
import { GenresPanel } from '../genres-panel/GenresPanel'
import { IdentityCard } from '../identity-card/IdentityCard'
import { ListCard } from '../list-card/ListCard'
import { PosterModal } from '../poster-modal/PosterModal'
import { ReleaseHistory } from '../release-history/ReleaseHistory'
import { SaveBar } from '../save-bar/SaveBar'
import { SectionCard } from '../section-card/SectionCard'

import styles from './ManualMediaForm.module.scss'

export interface ManualMediaFormProps {
	mode: 'create' | 'edit'
	id?: string
	initialDraft: ManualDraft
	initialCoverUrl?: string | null
	cancelTo: string
	typeUnset?: boolean
	onCreateList?: (mediaType: ManualDraft['media_type']) => void
	listCreated?: Unit<CreatedList>
}

export function ManualMediaForm({
	mode,
	id,
	initialDraft,
	initialCoverUrl,
	cancelTo,
	typeUnset = false,
	onCreateList,
	listCreated
}: ManualMediaFormProps) {
	const { t } = useTranslation()

	const {
		draft,
		patch,
		errors,
		typePicked,
		listOffered,
		lists,
		listNames,
		pickLists,
		cover,
		pickCover,
		previewCoverUrl,
		dirty,
		saving,
		suggesting,
		deleteOpen,
		setDeleteOpen,
		posterOpen,
		setPosterOpen,
		suggest,
		save,
		afterDelete,
		goBack
	} = useManualMediaForm({
		mode,
		id,
		initialDraft,
		initialCoverUrl,
		cancelTo,
		typeUnset,
		listCreated
	})

	return (
		<div className={styles.root}>
			<PageHeader
				title={t(mode === 'create' ? 'manualMedia.createTitle' : 'manualMedia.editTitle')}
				icon={<Icon name={mode === 'create' ? 'common/wand-sparkles' : 'common/pencil'} size={26} />}
				subtitle={t(mode === 'create' ? 'manualMedia.createSubtitle' : 'manualMedia.editSubtitle')}
			/>

			<div className={styles.layout}>
				<div className={styles.main}>
					<IdentityCard
						draft={draft}
						onChange={patch}
						coverUrl={previewCoverUrl}
						lockType={mode === 'edit'}
						typePicked={typePicked}
						typeError={errors.media_type}
						titleError={errors.title}
						disabled={saving}
						onOpenPoster={() => setPosterOpen(true)}
					/>

					{!typePicked && (
						<section className={styles.pending}>
							<Icon name='common/tag' size={20} />
							<p>{t('manualMedia.typePending')}</p>
						</section>
					)}

					{typePicked && (
						<div className={styles.cards}>
							<div className={styles.column}>
								{listOffered && (
									<ListCard
										lists={lists}
										value={listNames}
										onChange={pickLists}
										onCreateList={onCreateList && (() => onCreateList(draft.media_type))}
										disabled={saving}
									/>
								)}

								<SectionCard
									icon='common/calendar-clock'
									title={t('manualMedia.sections.releaseHistory')}
									subtitle={t('manualMedia.sections.releaseHistoryHint')}
								>
									<ReleaseHistory
										draft={draft}
										onChange={patch}
										error={errors.year}
										disabled={saving}
									/>
								</SectionCard>

								<SectionCard
									icon='common/users'
									title={t('manualMedia.sections.credits')}
									subtitle={t('manualMedia.sections.creditsHint')}
								>
									<DetailsTab draft={draft} onChange={patch} disabled={saving} />
								</SectionCard>
							</div>

							<div className={styles.column}>
								<SectionCard
									icon='common/clapperboard'
									title={t('manualMedia.sections.basics')}
									subtitle={t('manualMedia.sections.basicsHint')}
								>
									<BasicsTab draft={draft} onChange={patch} disabled={saving} />
								</SectionCard>

								<SectionCard
									icon='common/tag'
									title={t('manualMedia.sections.genres')}
									subtitle={t('manualMedia.sections.genresHint')}
								>
									<GenresPanel
										mediaType={draft.media_type}
										genres={draft.genres ?? []}
										onGenresChange={genres => patch({ genres })}
										disabled={saving}
									/>
								</SectionCard>

								<SectionCard
									icon='common/subtitles'
									title={t('manualMedia.fields.description')}
									subtitle={t('manualMedia.sections.descriptionHint')}
								>
									<Textarea
										value={draft.description ?? ''}
										onChange={event => patch({ description: event.target.value })}
										placeholder={t('manualMedia.fields.descriptionPlaceholder')}
										rows={8}
										maxLength={10000}
										disabled={saving}
									/>
								</SectionCard>
							</div>
						</div>
					)}
				</div>

				<aside className={styles.sidebar}>
					<CompletenessCard
						completeness={completeness(draft, previewCoverUrl !== null, typePicked)}
					/>

					<AIAssistantCard
						mode={mode}
						onGenerate={() => void suggest()}
						pending={suggesting}
						typeMissing={!typePicked}
						disabled={saving}
					/>
				</aside>
			</div>

			<SaveBar
				status={
					mode === 'create'
						? t('manualMedia.status.draft')
						: t(dirty ? 'manualMedia.status.dirty' : 'manualMedia.status.clean')
				}
				onCancel={goBack}
				onSave={() => void save()}
				saving={saving}
				saveLabel={t('manualMedia.save')}
				deleteAction={
					mode === 'edit' && (
						<Button
							variant='ghost'
							startIcon={<Icon name='common/trash' size={16} />}
							disabled={saving}
							onClick={() => setDeleteOpen(true)}
						>
							{t('manualMedia.delete.action')}
						</Button>
					)
				}
			/>

			<PosterModal
				open={posterOpen}
				onOpenChange={setPosterOpen}
				mediaType={draft.media_type}
				typeMissing={!typePicked}
				title={draft.title}
				year={draft.year}
				existingCoverUrl={initialCoverUrl}
				selection={cover}
				onChange={pickCover}
				disabled={saving}
			/>

			<DeleteManualMediaDialog
				open={deleteOpen}
				onOpenChange={setDeleteOpen}
				id={id}
				title={draft.title}
				onDeleted={afterDelete}
			/>
		</div>
	)
}
