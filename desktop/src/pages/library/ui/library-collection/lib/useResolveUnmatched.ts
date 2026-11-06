import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'

import { $nodeReady } from '@infra/node'

import { fetchMediaDetailsFx } from '@entities/media'
import type { LibraryCollectionEntry } from '@entities/library-item'

type ResolvedTitle = NonNullable<LibraryCollectionEntry['title']>

export function useResolveUnmatched(entries: LibraryCollectionEntry[]): Record<string, ResolvedTitle> {
	const nodeReady = useUnit($nodeReady)
	const [resolved, setResolved] = useState<Record<string, ResolvedTitle>>({})
	const key = entries
		.filter(entry => !entry.title)
		.map(entry => entry.media_ref)
		.join('|')

	useEffect(() => {
		if (!nodeReady || !key) {
			return
		}

		let cancelled = false
		const refs = key.split('|').filter(ref => ref && !(ref in resolved))

		for (const ref of refs) {
			fetchMediaDetailsFx(ref)
				.then(({ media }) => {
					if (cancelled) {
						return
					}

					setResolved(state => ({
						...state,
						[ref]: {
							media_ref: media.media_ref,
							media_type: media.media_type as ResolvedTitle['media_type'],
							title: media.title.user_preferred ?? media.title.romaji ?? media.title.english ?? ref,
							cover_image: media.cover_image ?? undefined,
							cover_color: media.cover_color ?? undefined,
							format: media.format ?? undefined,
							episodes: (media.media_type === 'manga' ? media.chapters : media.episodes) ?? undefined
						}
					}))
				})
				.catch(() => {
				})
		}

		return () => {
			cancelled = true
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key, nodeReady])

	return resolved
}
