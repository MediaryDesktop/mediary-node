import clsx from 'clsx'
import { useEffect, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { Icon, Skeleton } from '@shared/ui'

import { enumLabel, mediaTitle, scoreTone } from '@entities/media'
import type { MediaSummary } from '@entities/media'

import styles from './DiscoverHero.module.scss'

// Long enough to read the synopsis, short enough that the banner feels alive.
const ROTATE_EVERY = 8000

export interface DiscoverHeroProps {
	// The titles the banner goes through, in order. Empty while they load.
	items: MediaSummary[]
	loading: boolean
	onOpen: (media: MediaSummary) => void
}

// The banner over Discover: one title of the first row at a time, moving on by
// itself until the pointer rests on it, or jumped to with the dots.
export function DiscoverHero({ items, loading, onOpen }: DiscoverHeroProps) {
	const { t } = useTranslation()

	const [index, setIndex] = useState(0)
	const [paused, setPaused] = useState(false)

	const count = items.length
	const current = count > 0 ? items[index % count] : undefined

	useEffect(() => {
		if (paused || count < 2) {
			return
		}

		const timer = window.setInterval(() => setIndex(value => (value + 1) % count), ROTATE_EVERY)

		return () => window.clearInterval(timer)
	}, [paused, count])

	if (!current) {
		return (
			<header className={clsx(styles.hero, styles.placeholder)}>
				{loading && (
					<div className={clsx(styles.content, styles.loadingContent)}>
						<Skeleton width='14rem' height='2.5rem' radius='10px' />
						<Skeleton width='22rem' height='1rem' radius='6px' />
						<Skeleton width='18rem' height='1rem' radius='6px' />
					</div>
				)}
			</header>
		)
	}

	const backdrop = current.banner_image ?? current.cover_image
	const year = current.season_year ?? current.start_date?.year
	const format = enumLabel(t, 'format', current.format)
	const byline = current.media_type === 'book' ? current.authors?.join(', ') : null

	return (
		<header
			className={styles.hero}
			onMouseEnter={() => setPaused(true)}
			onMouseLeave={() => setPaused(false)}
		>
			<div className={styles.backdrop} style={{ backgroundColor: current.cover_color ?? undefined }}>
				{backdrop && (
					<img
						key={current.media_ref}
						src={backdrop}
						alt=''
						className={clsx(styles.image, !current.banner_image && styles.blurred)}
						draggable={false}
					/>
				)}
				<span className={styles.fadeLeft} />
				<span className={styles.fadeBottom} />
			</div>

			<div key={current.media_ref} className={styles.content}>
				{current.cover_image && (
					<button type='button' className={styles.cover} onClick={() => onOpen(current)}>
						<img src={current.cover_image} alt='' draggable={false} />
					</button>
				)}

				<div className={styles.info}>
					<h1 className={styles.title}>{mediaTitle(current.title)}</h1>

					<div className={styles.meta}>
						{current.average_score != null && (
							<span className={clsx(styles.score, styles[scoreTone(current.average_score)])}>
								<Icon name='common/heart' size={14} />
								{current.average_score / 10}
							</span>
						)}
						{byline && <span className={styles.byline}>{byline}</span>}
						{year && <span>{year}</span>}
						{format && <span>{format}</span>}
						{(current.genres ?? []).slice(0, 3).map(genre => (
							<span key={genre} className={styles.genre}>
								{genre}
							</span>
						))}
					</div>

					{current.description && <p className={styles.description}>{current.description}</p>}

					<button type='button' className={styles.detailsLink} onClick={() => onOpen(current)}>
						<Icon name='common/info' size={15} />
						{t('discover.open')}
					</button>
				</div>
			</div>

			{count > 1 && (
				<div className={styles.dots} role='tablist' aria-label={t('discover.featured')}>
					{items.map((item, position) => (
						<button
							key={item.media_ref}
							type='button'
							role='tab'
							aria-selected={position === index % count}
							aria-label={mediaTitle(item.title)}
							className={clsx(styles.dot, position === index % count && styles.active)}
							onClick={() => setIndex(position)}
						/>
					))}
				</div>
			)}
		</header>
	)
}
