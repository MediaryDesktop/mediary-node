import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'

import { $nodeReady } from '@infra/node'

import { fetchMediaDetailsFx } from '@entities/media'
import type { MediaDate } from '@entities/media'

export interface Synopsis {
	description?: string
	start_date?: MediaDate
}

export function useSynopses(refs: string[]): Record<string, Synopsis> {
	const nodeReady = useUnit($nodeReady)
	const [details, setDetails] = useState<Record<string, Synopsis>>({})
	const key = refs.join('|')

	useEffect(() => {
		if (!nodeReady) {
			return
		}

		let cancelled = false
		const missing = key.split('|').filter(ref => ref && !(ref in details))

		for (const ref of missing) {
			fetchMediaDetailsFx(ref)
				.then(({ media }) => {
					if (!cancelled) {
						setDetails(state => ({
							...state,
							[ref]: { description: media.description, start_date: media.start_date }
						}))
					}
				})
				.catch(() => {
					if (!cancelled) {
						setDetails(state => ({ ...state, [ref]: {} }))
					}
				})
		}

		return () => {
			cancelled = true
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key, nodeReady])

	return details
}
