import { useTranslation } from '@shared/i18n'
import { Carousel, Icon, Skeleton } from '@shared/ui'

import { episodeTitle } from '@entities/media'
import { thumbnailUrl } from '@entities/playback'
import { preferredTitle } from '@entities/tracker'

import { usePlayFile, useUpNextLabel } from '../../lib/useContinueWatching'
import type { ContinueWatchingState, UpNextEntry } from '../../lib/useContinueWatching'

import styles from './ContinueWatching.module.scss'
import { EpisodeImage } from '../episode-image/EpisodeImage'

const ITEM_WIDTH = '20rem'

export interface ContinueWatchingProps {
	state: ContinueWatchingState
	className?: string
}

// The next episodes as a row of stills: one click plays the file.
export function ContinueWatching({ state, className }: ContinueWatchingProps) {
	const { t } = useTranslation()
	const { play, starting } = usePlayFile()

	if (state.loading) {
		return (
			<Carousel title={t('home.continue.title')} itemWidth={ITEM_WIDTH} className={className}>
				{Array.from({ length: Math.min(state.pending, 4) }, (_, index) => (
					<Skeleton key={index} width='100%' height='11.25rem' radius='14px' />
				))}
			</Carousel>
		)
	}

	if (state.items.length === 0) {
		return null
	}

	return (
		<Carousel title={t('home.continue.title')} itemWidth={ITEM_WIDTH} className={className}>
			{state.items.map(item => (
				<UpNextCard key={item.mediaRef} item={item} disabled={starting} onPlay={play} />
			))}
		</Carousel>
	)
}

function UpNextCard({
	item,
	disabled,
	onPlay
}: {
	item: UpNextEntry
	disabled: boolean
	onPlay: (fileId: number) => void
}) {
	const { t, i18n } = useTranslation()
	const labelOf = useUpNextLabel()

	const { entry } = item
	const title = preferredTitle(entry.media.title)
	const label = labelOf(item)
	const name = item.episode ? episodeTitle(item.episode, i18n.language) : null

	return (
		<button
			type='button'
			className={styles.card}
			disabled={disabled}
			aria-label={t('media.library.play', { name: `${title} · ${label}` })}
			onClick={() => onPlay(item.file.id)}
		>
			<span className={styles.image} style={{ backgroundColor: entry.media.cover_color ?? undefined }}>
				<EpisodeImage
					sources={[
						item.episode?.image,
						thumbnailUrl(item.file.id),
						entry.media.banner_image,
						entry.media.cover_image
					]}
				/>
				<span className={styles.play}>
					<Icon name='common/play' size={32} />
				</span>
			</span>

			<span className={styles.text}>
				<span className={styles.title}>{title}</span>
				<span className={styles.meta}>
					<span className={styles.label}>{label}</span>
					{name && <span className={styles.name}>{name}</span>}
				</span>
			</span>
		</button>
	)
}
