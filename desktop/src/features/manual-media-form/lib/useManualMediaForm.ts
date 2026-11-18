import { useNavigate } from '@tanstack/react-router'
import { createEvent } from 'effector'
import type { Unit } from 'effector'
import { useUnit } from 'effector-react'
import { useRef, useState } from 'react'

import { getApiProblems, HttpRequestError, problemDetail } from '@shared/api'
import { isLanguage, useTranslation } from '@shared/i18n'
import { useGoBack, useUnitWatch } from '@shared/lib'
import { toast } from '@shared/ui'

import { useNodeData } from '@infra/node'

import { aiSettingsQuery, searchManualCoversFx, suggestManualMediaFx } from '@entities/media'
import type { ManualDraft, ManualHint } from '@entities/media'
import { isLocalTrackerType, trackerListsQuery } from '@entities/tracker'

import { saveManualMediaFx } from '../model/model'

import { hintNote, mergeSuggestion, withoutAiFilled } from './ai-merge'
import type { AiMergeField } from './ai-merge'
import type { CoverSelection } from './cover'
import { formatAfterTypeChange } from './draft'

// A list the user has just created from this form's "+ New list".
export interface CreatedList {
	name: string
	media_type: string
}

const NO_LIST_CREATED = createEvent<CreatedList>()

// What to say when the assistant refuses: 428 — no key is set up, 429 — the
// shared allowance is spent. Both are fixed in the app settings, so their
// toast offers a way there.
function aiFailureText(status: number) {
	if (status === 428) {
		return { fallback: 'manualMedia.ai.needsKey', settings: 'manualMedia.ai.openSettings' } as const
	}

	if (status === 429) {
		return { fallback: 'manualMedia.ai.limitReached', settings: 'manualMedia.ai.addOwn' } as const
	}

	return { fallback: 'manualMedia.ai.failed', settings: null } as const
}

export interface UseManualMediaFormOptions {
	mode: 'create' | 'edit'
	id?: string
	initialDraft: ManualDraft
	initialCoverUrl?: string | null
	cancelTo: string
	typeUnset?: boolean
	onInvalid?: (field: 'media_type' | 'title', action: 'save' | 'suggest') => void
	// Comes from whoever owns the list drawer the form asked to open; the form
	// picks the new list for the title it describes.
	listCreated?: Unit<CreatedList>
}

export function useManualMediaForm({
	mode,
	id,
	initialDraft,
	initialCoverUrl,
	cancelTo,
	typeUnset = false,
	onInvalid,
	listCreated = NO_LIST_CREATED
}: UseManualMediaFormOptions) {
	const { t, i18n } = useTranslation()
	const navigate = useNavigate()
	const goBack = useGoBack(cancelTo)
	const [refreshAISettings, saveManual, searchCovers, suggestDraft] = useUnit([
		aiSettingsQuery.start,
		saveManualMediaFx,
		searchManualCoversFx,
		suggestManualMediaFx
	])
	const listCollection = useUnit(trackerListsQuery.$data)

	const [draft, setDraft] = useState<ManualDraft>(initialDraft)
	const [aiFilled, setAiFilled] = useState<ReadonlySet<AiMergeField>>(new Set())
	const [cover, setCover] = useState<CoverSelection>({ kind: 'keep' })
	const autoCover = useRef(false)
	const [errors, setErrors] = useState<Record<string, string>>({})
	const [typePicked, setTypePicked] = useState(!typeUnset)
	const [listNames, setListNames] = useState<string[]>([])
	const [saving, setSaving] = useState(false)
	const [suggesting, setSuggesting] = useState(false)
	const [deleteOpen, setDeleteOpen] = useState(false)
	const [posterOpen, setPosterOpen] = useState(false)

	// Every new title is in "My titles" already; one of the user's own lists is
	// an extra place for it. Anime and manga have none to offer: their lists are
	// AniList's, which a hand-made title is not on.
	const listOffered = mode === 'create' && typePicked && isLocalTrackerType(draft.media_type)
	const lists = (listCollection?.lists ?? []).filter(list => list.media_type === draft.media_type)

	useNodeData(trackerListsQuery, { enabled: mode === 'create' })

	useUnitWatch(listCreated, list => {
		if (mode === 'create' && list.media_type === draft.media_type) {
			setListNames(current => (current.includes(list.name) ? current : [...current, list.name]))
		}
	})

	// Both actions need to know what the title is: its type and its name. The
	// first missing one is marked on the form, and the caller hears which.
	const requireTypeAndTitle = (action: 'save' | 'suggest'): string | null => {
		if (!typePicked) {
			setErrors(current => ({ ...current, media_type: t('manualMedia.validation.typeRequired') }))
			onInvalid?.('media_type', action)
			return null
		}

		const title = draft.title.trim()
		if (title === '') {
			setErrors(current => ({ ...current, title: t('manualMedia.validation.titleRequired') }))
			onInvalid?.('title', action)
			return null
		}

		return title
	}

	const patch = (next: Partial<ManualDraft>) => {
		if (next.media_type) {
			setTypePicked(true)

			if (next.media_type !== draft.media_type) {
				setListNames([])
			}
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

	const dropAutoCover = () => {
		if (autoCover.current) {
			autoCover.current = false
			setCover({ kind: 'keep' })
		}
	}

	const findPoster = async (found: ManualDraft) => {
		if (initialCoverUrl || (cover.kind !== 'keep' && !autoCover.current)) {
			return
		}

		try {
			const result = await searchCovers({
				type: found.media_type,
				title: found.title,
				year: found.year
			})
			const image = result.images?.[0]

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
		} catch {}
	}

	const suggest = async () => {
		const title = requireTypeAndTitle('suggest')
		if (title === null) {
			return
		}

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
			const suggestion = await suggestDraft(hint)
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
			const { fallback, settings } = aiFailureText(failure.status)

			toast.error(problemDetail(failure, t(fallback)), {
				id: 'manual-media-ai',
				action: settings
					? {
							label: t(settings),
							onClick: () => navigate({ to: '/settings', search: { section: 'app' } })
						}
					: undefined
			})
		} finally {
			setSuggesting(false)
			refreshAISettings()
		}
	}

	const save = async () => {
		if (requireTypeAndTitle('save') === null) {
			return
		}

		if (mode === 'edit' && !id) {
			return
		}

		setSaving(true)

		try {
			const saved = await saveManual({
				id: mode === 'create' ? null : (id ?? null),
				draft,
				cover,
				listNames: listOffered ? listNames : []
			})

			if (!saved.coverSaved) {
				toast.error(t('manualMedia.cover.failed'), { id: 'manual-media-cover' })
			}

			if (!saved.listSaved) {
				toast.error(t('manualMedia.list.failed'), { id: 'manual-media-list' })
			}

			toast.success(t(mode === 'create' ? 'manualMedia.saved' : 'manualMedia.updated'), {
				id: 'manual-media-save'
			})
			void navigate({ to: '/media/$mediaRef', params: { mediaRef: saved.mediaRef } })
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

	const afterDelete = () => {
		setDeleteOpen(false)
		void navigate({ to: '/library' })
	}

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
		listOffered,
		lists,
		listNames,
		pickLists: setListNames,
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
	}
}
