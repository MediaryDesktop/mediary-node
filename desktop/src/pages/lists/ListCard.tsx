import clsx from 'clsx'

import { useTranslation } from '@shared/i18n'
import { formatRelativeTime } from '@shared/lib'

import { MediaTypeIcon } from '@entities/tracker'
import type { TrackerCustomList } from '@entities/tracker'

import { ListOptionsMenu } from '@features/manage-lists'

import styles from './ListCard.module.scss'

export interface ListCardProps {
	list: TrackerCustomList
	view: 'grid' | 'rows'
	onOpen: () => void
}

export function ListCard({ list, view, onOpen }: ListCardProps) {
	const { t, i18n } = useTranslation()

	const covers = (list.covers ?? []).slice(0, 3)
	const hidden = Math.max(list.count - covers.length, 0)

	const meta = [
		list.count > 0 ? t('lists.titleCount', { count: list.count }) : t('lists.card.empty'),
		list.updated_at &&
			t('lists.card.updated', { when: formatRelativeTime(list.updated_at, i18n.language) })
	].filter(Boolean)

	return (
		<article className={clsx(styles.card, view === 'rows' && styles.row)}>
			<button type='button' className={styles.open} onClick={onOpen}>
				<span className={styles.collage} aria-hidden>
					{[0, 1, 2].map(slot => (
						<span key={slot} className={styles.tile}>
							{covers[slot] && (
								<img src={covers[slot]} alt='' loading='lazy' draggable={false} />
							)}
						</span>
					))}

					{hidden > 0 && (
						<span className={styles.overflow}>{t('lists.card.overflow', { count: hidden })}</span>
					)}
				</span>

				<span className={styles.text}>
					<span className={styles.name}>{list.name}</span>
					<span className={styles.meta}>{meta.join(' · ')}</span>
					<span className={styles.badge}>
						<MediaTypeIcon type={list.media_type} size={16} />
						{t(`lists.mediaType.${list.media_type}`)}
					</span>
				</span>
			</button>

			<div className={styles.menu}>
				<ListOptionsMenu list={list} />
			</div>
		</article>
	)
}
