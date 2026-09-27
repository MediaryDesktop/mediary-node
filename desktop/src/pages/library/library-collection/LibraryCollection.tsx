import { useNavigate } from '@tanstack/react-router'

import { useTranslation } from '@shared/i18n'
import { Badge } from '@shared/ui'

import type { LibraryCollectionEntry } from '@entities/library-item'
import { MediaCard } from '@entities/media'

import styles from './LibraryCollection.module.scss'

export interface LibraryCollectionProps {
	entries: LibraryCollectionEntry[]
}

export function LibraryCollection({ entries }: LibraryCollectionProps) {
	const { t } = useTranslation()
	const navigate = useNavigate()

	return (
		<ul className={styles.grid}>
			{entries.map(entry => (
				<li key={entry.media_ref}>
					<MediaCard
						media={{
							// The library knows a title by one name; the card is built for the
							// catalog's several, so the one there is stands in for all of them.
							title: {
								user_preferred: entry.title?.title ?? entry.media_ref,
								english: null,
								romaji: null,
								native: null
							},
							cover_image: entry.title?.cover_image ?? null,
							cover_color: entry.title?.cover_color ?? null
						}}
						cornerLabel={t('library.summary.files', { count: entry.file_count })}
						onOpen={() =>
							navigate({ to: '/media/$mediaRef', params: { mediaRef: entry.media_ref } })
						}
					>
						{entry.missing_count > 0 && (
							<Badge tone='danger'>
								{t('library.root.missing', { count: entry.missing_count })}
							</Badge>
						)}
					</MediaCard>
				</li>
			))}
		</ul>
	)
}
