import { createEffect, createEvent, createStore, sample } from 'effector'

import { setupRequired } from '@shared/api'
import { atom } from '@shared/factory'

import { searchMediaFx } from '@entities/media'
import type { MediaSummary } from '@entities/media'

import type { DiscoverSection } from '../lib/sections'

const FRESH_FOR = 30 * 60 * 1000

export interface SectionState {
	status: 'loading' | 'done' | 'failed'
	items: MediaSummary[]
	setupNeeded: string | null
	fetchedAt: number
}

export const discoverModel = atom(() => {
	const sectionsRequested = createEvent<DiscoverSection[]>()
	const sectionRetried = createEvent<DiscoverSection>()

	const loadSectionFx = createEffect(async (section: DiscoverSection) => {
		const response = await searchMediaFx(section.query)

		return response.results.items as MediaSummary[]
	})

	const loadManyFx = createEffect((sections: DiscoverSection[]) => {
		for (const section of sections) {
			void loadSectionFx(section)
		}
	})

	const $sections = createStore<Record<string, SectionState>>({})
		.on(loadSectionFx, (state, section) => ({
			...state,
			[section.key]: {
				status: 'loading',
				items: state[section.key]?.items ?? [],
				setupNeeded: null,
				fetchedAt: state[section.key]?.fetchedAt ?? 0
			}
		}))
		.on(loadSectionFx.done, (state, { params, result }) => ({
			...state,
			[params.key]: { status: 'done', items: result, setupNeeded: null, fetchedAt: Date.now() }
		}))
		.on(loadSectionFx.fail, (state, { params, error }) => ({
			...state,
			[params.key]: {
				status: 'failed',
				items: state[params.key]?.items ?? [],
				setupNeeded: setupRequired(error),
				fetchedAt: 0
			}
		}))

	const staleFound = sample({
		clock: sectionsRequested,
		source: $sections,
		fn: (state, sections) =>
			sections.filter(section => {
				const current = state[section.key]
				if (!current) {
					return true
				}

				return (
					current.status !== 'loading' &&
					(current.status === 'failed' || Date.now() - current.fetchedAt > FRESH_FOR)
				)
			})
	})

	sample({ clock: staleFound, filter: stale => stale.length > 0, target: loadManyFx })

	sample({ clock: sectionRetried, target: loadSectionFx })

	return { $sections, sectionsRequested, sectionRetried }
})
