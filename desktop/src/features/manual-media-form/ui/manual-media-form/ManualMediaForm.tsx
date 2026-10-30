import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { getApiProblems, HttpRequestError, problemDetail } from '@shared/api'
import { isLanguage, useTranslation } from '@shared/i18n'
import { useGoBack } from '@shared/lib'
import { Button, Icon, Modal, Tabs, Textarea, toast } from '@shared/ui'

import {
	createManualMediaFx,
	deleteManualCoverFx,
	deleteManualMediaFx,
	setManualCoverFx,
	suggestManualMediaFx,
	updateManualMediaFx
} from '@entities/media'
import type { ManualDraft, ManualHint } from '@entities/media'

import { completeness, hintNote, manualId, mergeSuggestion } from '../../lib/draft'
import type { AiMergeField } from '../../lib/draft'
import { AIAssistantCard } from '../ai-assistant-card/AIAssistantCard'
import { BasicsTab } from '../basics-tab/BasicsTab'
import { CompletenessCard } from '../completeness-card/CompletenessCard'
import { DetailsTab } from '../details-tab/DetailsTab'
import { Field } from '../field/Field'
import type { FillModeValue } from '../fill-mode/FillMode'
import { FillMode } from '../fill-mode/FillMode'
import { GenresPanel } from '../genres-panel/GenresPanel'
import { IdentityCard } from '../identity-card/IdentityCard'
import type { CoverSelection } from '../poster-card/PosterCard'
import { PosterCard } from '../poster-card/PosterCard'
import { SaveBar } from '../save-bar/SaveBar'

import styles from './ManualMediaForm.module.scss'

export interface ManualMediaFormProps {
	mode: 'create' | 'edit'
	// The manual title's id (without the manual: prefix); edit mode only.
	id?: string
	initialDraft: ManualDraft
	initialCoverUrl?: string | null
	cancelTo: string
}

type Tab = 'basic' | 'details' | 'description'

function coverSource(selection: CoverSelection): { url?: string; data?: string } | null {
	if (selection.kind === 'url') {
		return { url: selection.value }
	}

	if (selection.kind === 'data') {
		return { data: selection.value }
	}

	return null
}

export function ManualMediaForm({ mode, id, initialDraft, initialCoverUrl, cancelTo }: ManualMediaFormProps) {
	const { t, i18n } = useTranslation()
	const navigate = useNavigate()
	const goBack = useGoBack(cancelTo)

	const [draft, setDraft] = useState<ManualDraft>(initialDraft)
	const [aiFilled, setAiFilled] = useState<ReadonlySet<AiMergeField>>(new Set())
	const [cover, setCover] = useState<CoverSelection>({ kind: 'keep' })
	const [errors, setErrors] = useState<Record<string, string>>({})
	const [tab, setTab] = useState<Tab>('basic')
	const [fillMode, setFillMode] = useState<FillModeValue>('ai')
	const [saving, setSaving] = useState(false)
	const [suggesting, setSuggesting] = useState(false)
	const [deleting, setDeleting] = useState(false)
	const [deleteOpen, setDeleteOpen] = useState(false)

	const patch = (next: Partial<ManualDraft>) => {
		setDraft(current => ({ ...current, ...next }))

		const touched = Object.keys(next) as AiMergeField[]
		if (touched.some(field => aiFilled.has(field))) {
			setAiFilled(current => {
				const without = new Set(current)
				for (const field of touched) {
					without.delete(field)
				}
				return without
			})
		}

		if (touched.some(field => field in errors)) {
			setErrors(current => {
				const without = { ...current }
				for (const field of touched) {
					delete without[field]
				}
				return without
			})
		}
	}

	const suggest = async () => {
		const title = draft.title.trim()
		if (title === '') {
			setErrors(current => ({ ...current, title: t('manualMedia.validation.titleRequired') }))
			return
		}

		const hint: ManualHint = {
			media_type: draft.media_type,
			title,
			year: draft.year,
			note: hintNote(draft),
			language: isLanguage(i18n.language) ? i18n.language : 'en'
		}

		setSuggesting(true)

		try {
			const suggestion = await suggestManualMediaFx(hint)
			const { draft: merged, filled } = mergeSuggestion(draft, suggestion.draft)

			setDraft(merged)
			setAiFilled(current => new Set([...current, ...filled]))

			toast[suggestion.recognized ? 'success' : 'info'](
				t(suggestion.recognized ? 'manualMedia.ai.recognized' : 'manualMedia.ai.unrecognized'),
				{ id: 'manual-media-ai' }
			)
		} catch (error) {
			const failure = HttpRequestError.fromUnknown(error)

			if (failure.status === 428) {
				toast.error(t('manualMedia.ai.needsKey'), {
					id: 'manual-media-ai',
					action: {
						label: t('manualMedia.ai.openSettings'),
						onClick: () => navigate({ to: '/settings', search: { section: 'manual-media' } })
					}
				})
			} else {
				toast.error(problemDetail(failure, t('manualMedia.ai.failed')), {
					id: 'manual-media-ai'
				})
			}
		} finally {
			setSuggesting(false)
		}
	}

	const applyCover = async (coverId: string) => {
		if (cover.kind === 'remove') {
			await deleteManualCoverFx(coverId)
			return
		}

		const source = coverSource(cover)
		if (source) {
			await setManualCoverFx({ id: coverId, source })
		}
	}

	const save = async () => {
		const title = draft.title.trim()
		if (title === '') {
			setErrors(current => ({ ...current, title: t('manualMedia.validation.titleRequired') }))
			setTab('basic')
			return
		}

		setSaving(true)

		try {
			if (mode === 'create') {
				const created = await createManualMediaFx(draft)
				const newId = manualId(created.media.media_ref)

				try {
					await applyCover(newId)
				} catch {
					toast.error(t('manualMedia.cover.failed'), { id: 'manual-media-cover' })
				}

				toast.success(t('manualMedia.saved'), { id: 'manual-media-save' })
				void navigate({ to: '/media/$mediaRef', params: { mediaRef: created.media.media_ref } })
				return
			}

			if (!id) {
				return
			}

			const updated = await updateManualMediaFx({ id, draft })

			try {
				await applyCover(id)
			} catch {
				toast.error(t('manualMedia.cover.failed'), { id: 'manual-media-cover' })
			}

			toast.success(t('manualMedia.updated'), { id: 'manual-media-save' })
			void navigate({ to: '/media/$mediaRef', params: { mediaRef: updated.media.media_ref } })
		} catch (error) {
			const failure = HttpRequestError.fromUnknown(error)
			const problems = getApiProblems(failure)

			if (problems.length > 0) {
				setErrors(current => {
					const next = { ...current }
					for (const problem of problems) {
						next[problem.field] = problem.message
					}
					return next
				})
			}

			toast.error(problemDetail(failure, t('manualMedia.saveFailed')), {
				id: 'manual-media-save'
			})
		} finally {
			setSaving(false)
		}
	}

	const confirmDelete = async () => {
		if (!id) {
			return
		}

		setDeleting(true)

		try {
			await deleteManualMediaFx(id)
			setDeleteOpen(false)
			void navigate({ to: '/library' })
		} catch (error) {
			toast.error(problemDetail(HttpRequestError.fromUnknown(error), t('manualMedia.delete.failed')), {
				id: 'manual-media-delete'
			})
		} finally {
			setDeleting(false)
		}
	}

	const previewCoverUrl =
		cover.kind === 'remove' ? null : cover.kind === 'keep' ? (initialCoverUrl ?? null) : cover.previewUrl

	const dirty = JSON.stringify(draft) !== JSON.stringify(initialDraft) || cover.kind !== 'keep'

	return (
		<div className={styles.root}>
			<p className={styles.intro}>
				{t(mode === 'create' ? 'manualMedia.createSubtitle' : 'manualMedia.editSubtitle')}
			</p>

			<div className={styles.layout}>
				<div className={styles.main}>
					<IdentityCard
						draft={draft}
						onChange={patch}
						coverUrl={previewCoverUrl}
						lockType={mode === 'edit'}
						titleError={errors.title}
						disabled={saving}
						onPickCover={setCover}
					/>

					<Tabs
						value={tab}
						onValueChange={setTab}
						items={[
							{ value: 'basic', label: t('manualMedia.tabs.basic') },
							{ value: 'details', label: t('manualMedia.tabs.details') },
							{ value: 'description', label: t('manualMedia.tabs.description') }
						]}
					/>

					{tab === 'basic' && (
						<div className={styles.basicGrid}>
							<div className={styles.basicMain}>
								<FillMode value={fillMode} onChange={setFillMode} disabled={saving} />

								<BasicsTab
									draft={draft}
									onChange={patch}
									aiFilled={aiFilled}
									errors={errors}
									disabled={saving}
								/>
							</div>

							<GenresPanel
								mediaType={draft.media_type}
								genres={draft.genres ?? []}
								onGenresChange={genres => patch({ genres })}
								score={draft.score}
								onScoreChange={score => patch({ score })}
								aiGenres={aiFilled.has('genres')}
								disabled={saving}
							/>
						</div>
					)}

					{tab === 'details' && (
						<DetailsTab draft={draft} onChange={patch} aiFilled={aiFilled} disabled={saving} />
					)}

					{tab === 'description' && (
						<Field label={t('manualMedia.fields.description')} ai={aiFilled.has('description')}>
							<Textarea
								value={draft.description ?? ''}
								onChange={event => patch({ description: event.target.value })}
								placeholder={t('manualMedia.fields.descriptionPlaceholder')}
								rows={10}
								maxLength={10000}
								disabled={saving}
							/>
						</Field>
					)}
				</div>

				<aside className={styles.sidebar}>
					<CompletenessCard completeness={completeness(draft, previewCoverUrl !== null)} />

					<PosterCard
						mediaType={draft.media_type}
						title={draft.title}
						year={draft.year}
						existingCoverUrl={initialCoverUrl}
						selection={cover}
						onChange={setCover}
						disabled={saving}
					/>

					{fillMode === 'ai' && (
						<AIAssistantCard
							mode={mode}
							onGenerate={() => void suggest()}
							pending={suggesting}
							disabled={saving}
						/>
					)}
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

			<Modal
				open={deleteOpen}
				onOpenChange={setDeleteOpen}
				size='sm'
				title={t('manualMedia.delete.title', { title: draft.title })}
				description={t('manualMedia.delete.hint')}
				footer={
					<>
						<Button variant='secondary' onClick={() => setDeleteOpen(false)} disabled={deleting}>
							{t('manualMedia.cancel')}
						</Button>

						<Button variant='primary' onClick={() => void confirmDelete()} loading={deleting}>
							{t('manualMedia.delete.confirm')}
						</Button>
					</>
				}
			/>
		</div>
	)
}
