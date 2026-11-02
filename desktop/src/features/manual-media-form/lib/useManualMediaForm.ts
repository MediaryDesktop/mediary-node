import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useRef, useState } from 'react'

import { getApiProblems, HttpRequestError, problemDetail } from '@shared/api'
import { isLanguage, useTranslation } from '@shared/i18n'
import { useGoBack } from '@shared/lib'
import { toast } from '@shared/ui'

import {
	aiSettingsQuery,
	createManualMediaFx,
	deleteManualCoverFx,
	deleteManualMediaFx,
	searchManualCoversFx,
	setManualCoverFx,
	suggestManualMediaFx,
	updateManualMediaFx
} from '@entities/media'
import type { ManualDraft, ManualHint } from '@entities/media'

import type { CoverSelection } from '../ui/poster-modal/PosterModal'

import { formatAfterTypeChange, hintNote, manualId, mergeSuggestion, withoutAiFilled } from './draft'
import type { AiMergeField } from './draft'

export interface UseManualMediaFormOptions {
	mode: 'create' | 'edit'
	// The manual title's id (without the manual: prefix); edit mode only.
	id?: string
	initialDraft: ManualDraft
	initialCoverUrl?: string | null
	cancelTo: string
	// A new title opened with no kind in mind: the draft holds a placeholder kind
	// until the user picks one, so a book is never made an anime by default.
	typeUnset?: boolean
	// A field the form refused to go on without, so the layout can bring it into
	// view — each design keeps its fields in different places.
	onInvalid?: (field: 'media_type' | 'title', action: 'save' | 'suggest') => void
}

function coverSource(selection: CoverSelection): { url?: string; data?: string } | null {
	if (selection.kind === 'url') {
		return { url: selection.value }
	}

	if (selection.kind === 'data') {
		return { data: selection.value }
	}

	return null
}

// Everything a manual title form does — the draft, the AI fill, the poster and
// saving — kept apart from how the form is laid out.
export function useManualMediaForm({
	mode,
	id,
	initialDraft,
	initialCoverUrl,
	cancelTo,
	typeUnset = false,
	onInvalid
}: UseManualMediaFormOptions) {
	const { t, i18n } = useTranslation()
	const navigate = useNavigate()
	const goBack = useGoBack(cancelTo)
	const refreshAISettings = useUnit(aiSettingsQuery.start)

	const [draft, setDraft] = useState<ManualDraft>(initialDraft)
	const [aiFilled, setAiFilled] = useState<ReadonlySet<AiMergeField>>(new Set())
	const [cover, setCover] = useState<CoverSelection>({ kind: 'keep' })
	// Whether the poster in place was put there by the AI fill, not picked by the
	// user: only such a poster is swapped when the next fill finds another title.
	const autoCover = useRef(false)
	const [errors, setErrors] = useState<Record<string, string>>({})
	const [typePicked, setTypePicked] = useState(!typeUnset)
	const [saving, setSaving] = useState(false)
	const [suggesting, setSuggesting] = useState(false)
	const [deleting, setDeleting] = useState(false)
	const [deleteOpen, setDeleteOpen] = useState(false)
	const [posterOpen, setPosterOpen] = useState(false)

	const requireType = (action: 'save' | 'suggest') => {
		if (typePicked) {
			return true
		}

		setErrors(current => ({ ...current, media_type: t('manualMedia.validation.typeRequired') }))
		onInvalid?.('media_type', action)

		return false
	}

	const patch = (next: Partial<ManualDraft>) => {
		if (next.media_type) {
			setTypePicked(true)
		}

		setDraft(current => ({
			...current,
			...next,
			...(next.media_type
				? {
						format: formatAfterTypeChange(
							next.media_type,
							'format' in next ? next.format : current.format
						)
					}
				: {})
		}))

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

	// The poster an earlier fill chose belongs to the title it was chosen for.
	const dropAutoCover = () => {
		if (autoCover.current) {
			autoCover.current = false
			setCover({ kind: 'keep' })
		}
	}

	// A title the AI has just filled in has what a poster search needs, so the
	// search runs now rather than leaving the trip to the poster window. It never
	// replaces a poster the user picked or the title already has, only one an
	// earlier fill chose for another title; a failed search stays quiet: the
	// filled-in form is what the user asked for.
	const findPoster = async (found: ManualDraft) => {
		if (initialCoverUrl || (cover.kind !== 'keep' && !autoCover.current)) {
			return
		}

		try {
			const result = await searchManualCoversFx({
				type: found.media_type,
				title: found.title,
				year: found.year
			})
			const image = result.images?.[0]

			// Only a catalog's poster is the title's own; a picture search finds
			// whatever mentions the words, so those are left for the user to pick.
			if (image?.source === 'catalog') {
				setCover(current =>
					current.kind === 'keep' || autoCover.current
						? { kind: 'url', value: image.url, previewUrl: image.thumbnail, source: 'search' }
						: current
				)
				autoCover.current = true
			} else {
				dropAutoCover()
			}
		} catch {
			// The poster window is still there to search by hand.
		}
	}

	const suggest = async () => {
		if (!requireType('suggest')) {
			return
		}

		const title = draft.title.trim()
		if (title === '') {
			setErrors(current => ({ ...current, title: t('manualMedia.validation.titleRequired') }))
			onInvalid?.('title', 'suggest')
			return
		}

		// Only what the user typed describes the title; what an earlier fill added
		// may be for another one.
		const own = withoutAiFilled(draft, aiFilled)

		const hint: ManualHint = {
			media_type: draft.media_type,
			title,
			year: own.year,
			note: hintNote(own),
			language: isLanguage(i18n.language) ? i18n.language : 'en'
		}

		setSuggesting(true)

		try {
			const suggestion = await suggestManualMediaFx(hint)
			const { draft: merged, filled } = mergeSuggestion(draft, suggestion.draft, aiFilled)

			setDraft(merged)
			setAiFilled(filled)

			toast[suggestion.recognized ? 'success' : 'info'](
				t(suggestion.recognized ? 'manualMedia.ai.recognized' : 'manualMedia.ai.unrecognized'),
				{ id: 'manual-media-ai' }
			)

			if (suggestion.recognized) {
				void findPoster(merged)
			} else {
				dropAutoCover()
			}
		} catch (error) {
			const failure = HttpRequestError.fromUnknown(error)

			const openSettings = () => navigate({ to: '/settings', search: { section: 'app' } })

			if (failure.status === 428) {
				toast.error(problemDetail(failure, t('manualMedia.ai.needsKey')), {
					id: 'manual-media-ai',
					action: { label: t('manualMedia.ai.openSettings'), onClick: openSettings }
				})
			} else if (failure.status === 429) {
				toast.error(problemDetail(failure, t('manualMedia.ai.limitReached')), {
					id: 'manual-media-ai',
					action: { label: t('manualMedia.ai.addOwn'), onClick: openSettings }
				})
			} else {
				toast.error(problemDetail(failure, t('manualMedia.ai.failed')), {
					id: 'manual-media-ai'
				})
			}
		} finally {
			setSuggesting(false)
			refreshAISettings()
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
		if (!requireType('save')) {
			return
		}

		const title = draft.title.trim()
		if (title === '') {
			setErrors(current => ({ ...current, title: t('manualMedia.validation.titleRequired') }))
			onInvalid?.('title', 'save')
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

	// A poster the user picks by hand is theirs: the next AI fill leaves it be.
	const pickCover = (chosen: CoverSelection) => {
		autoCover.current = false
		setCover(chosen)
	}

	const previewCoverUrl =
		cover.kind === 'remove' ? null : cover.kind === 'keep' ? (initialCoverUrl ?? null) : cover.previewUrl

	const dirty = JSON.stringify(draft) !== JSON.stringify(initialDraft) || cover.kind !== 'keep'

	return {
		draft,
		patch,
		aiFilled,
		errors,
		typePicked,
		cover,
		pickCover,
		previewCoverUrl,
		dirty,
		saving,
		suggesting,
		deleting,
		deleteOpen,
		setDeleteOpen,
		posterOpen,
		setPosterOpen,
		suggest,
		save,
		confirmDelete,
		goBack
	}
}
