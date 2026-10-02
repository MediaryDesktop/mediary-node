import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { useTranslation } from '@shared/i18n'
import { Badge, Icon, Skeleton, toast } from '@shared/ui'

import { fileDuration, fileName, fileTitle, titleFilesQuery } from '@entities/library-item'
import type { LibraryFile } from '@entities/library-item'
import { playbackModel } from '@entities/playback'

import { episodeNumber, groupTitleFiles, isWatched } from '../lib/episodes'

import styles from './LibrarySection.module.scss'

const MAX_EPISODE_PLACEHOLDERS = 28

export interface LibrarySectionProps {
	mediaRef: string
	cover: string | null
	coverColor: string | null
	banner: string | null
	total: number | null | undefined
	mediaType: string
	progress: number
}

export function LibrarySection({
	mediaRef,
	cover,
	coverColor,
	banner,
	total,
	mediaType,
	progress
}: LibrarySectionProps) {
	const { t } = useTranslation()

	const episodeLabel = useEpisodeLabel()

	const [data, load, play, session, starting] = useUnit([
		titleFilesQuery.$data,
		titleFilesQuery.start,
		playbackModel.playRequested,
		playbackModel.$session,
		playbackModel.$starting
	])

	useEffect(() => {
		load(mediaRef)
	}, [mediaRef, load])

	useEffect(
		() =>
			playbackModel.playFailed.watch(({ error }) =>
				toast.error(error.body?.detail ?? t('playback.failed'), { id: 'playback-failed' })
			),
		[t]
	)

	if (mediaType !== 'anime') {
		return null
	}

	// The query is shared across title pages, so what it holds may still be the
	// previous title's files for a moment after navigating.
	const files = (data?.files.items ?? []).filter(file => file.match?.media_ref === mediaRef)

	if (files.length === 0) {
		return <NotInLibrary cover={cover} coverColor={coverColor} total={total} />
	}

	const groups = groupTitleFiles(files, progress)
	const image = banner ?? cover

	const item = (file: LibraryFile) => (
		<EpisodeItem
			key={file.id}
			file={file}
			image={image}
			coverColor={coverColor}
			watched={isWatched(file, progress)}
			playing={session?.file_id === file.id}
			disabled={starting}
			onPlay={play}
		/>
	)

	return (
		<section className={styles.section}>
			{groups.toWatch.length > 0 && (
				<ul className={styles.toWatch} aria-label={t('media.library.toWatch')}>
					{groups.toWatch.map(file => (
						<li key={file.id}>
							<button
								type='button'
								className={styles.card}
								style={{ backgroundColor: coverColor ?? undefined }}
								disabled={starting}
								onClick={() => play(file.id)}
							>
								{image && <img src={image} alt='' loading='lazy' />}
								<span className={styles.cardPlay}>
									<Icon name='common/play' size={32} />
								</span>
								<span className={styles.cardText}>
									<span className={styles.cardTitle}>{episodeLabel(file)}</span>
									{fileDuration(file) && (
										<span className={styles.cardMeta}>{fileDuration(file)}</span>
									)}
								</span>
							</button>
						</li>
					))}
				</ul>
			)}

			<ul className={styles.episodes}>{groups.main.map(item)}</ul>

			{groups.specials.length > 0 && (
				<>
					<h3 className={styles.groupTitle}>{t('media.library.specials')}</h3>
					<ul className={styles.episodes}>{groups.specials.map(item)}</ul>
				</>
			)}

			{groups.others.length > 0 && (
				<>
					<h3 className={styles.groupTitle}>{t('media.library.others')}</h3>
					<ul className={styles.episodes}>{groups.others.map(item)}</ul>
				</>
			)}
		</section>
	)
}

// A movie or an unnumbered file has no "Episode N" to show, so it goes by its name.
function useEpisodeLabel() {
	const { t } = useTranslation()

	return (file: LibraryFile): string => {
		const number = episodeNumber(file)

		return number === null ? fileTitle(file) : String(t('media.library.episode', { number }))
	}
}

interface EpisodeItemProps {
	file: LibraryFile
	image: string | null
	coverColor: string | null
	watched: boolean
	playing: boolean
	disabled: boolean
	onPlay: (fileId: number) => void
}

function EpisodeItem({ file, image, coverColor, watched, playing, disabled, onPlay }: EpisodeItemProps) {
	const { t } = useTranslation()
	const label = useEpisodeLabel()(file)
	const duration = fileDuration(file)

	return (
		<li className={clsx(styles.episode, watched && styles.watched)}>
			<button
				type='button'
				className={styles.episodeImage}
				style={{ backgroundColor: coverColor ?? undefined }}
				disabled={disabled || file.missing}
				aria-label={t('media.library.play', { name: label })}
				onClick={() => onPlay(file.id)}
			>
				{image && <img src={image} alt='' loading='lazy' />}
				<span className={styles.episodePlay}>
					<Icon name='common/play' size={24} />
				</span>
			</button>

			<span className={styles.episodeContent}>
				<span className={styles.episodeTitle}>
					{label}
					{playing && <Badge tone='accent'>{t('media.library.playing')}</Badge>}
				</span>
				<span className={styles.episodeFile} title={file.rel_path}>
					{fileName(file)}
				</span>
				<span className={styles.episodeMeta}>
					{duration && <span>{duration}</span>}
					{watched && (
						<span className={styles.watchedMark}>
							<Icon name='common/check' size={14} />
							{t('media.library.watched')}
						</span>
					)}
					{file.missing && <span className={styles.missing}>{t('media.library.missing')}</span>}
				</span>
			</span>
		</li>
	)
}

interface NotInLibraryProps {
	cover: string | null
	coverColor: string | null
	total: number | null | undefined
}

function NotInLibrary({ cover, coverColor, total }: NotInLibraryProps) {
	const { t } = useTranslation()

	if (!total) {
		return null
	}

	const shown = Math.min(total, MAX_EPISODE_PLACEHOLDERS)
	const episodes = Array.from({ length: shown }, (_, index) => index + 1)

	return (
		<section className={styles.section}>
			<h2 className={styles.libraryTitle}>
				<Icon name='common/library' size={20} />
				{t('media.library.notInLibrary')}
			</h2>

			<p className={styles.libraryText}>{t('media.library.episodesNotInLibrary')}</p>
			<p className={styles.libraryNotice}>{t('media.library.metadataUnavailable')}</p>

			<ul className={styles.episodes}>
				{episodes.map(number => (
					<li key={number} className={styles.episode}>
						<span
							className={clsx(styles.episodeImage, styles.placeholderImage)}
							style={{ backgroundColor: coverColor ?? undefined }}
						>
							{cover && <img src={cover} alt='' loading='lazy' />}
						</span>

						<span className={styles.episodeContent}>
							<span className={styles.episodeTitle}>
								{t('media.library.episode', { number })}
							</span>
							<span className={styles.episodePlaceholder}>
								<Skeleton width='70%' height='0.75rem' />
								<Skeleton width='45%' height='0.75rem' />
							</span>
						</span>
					</li>
				))}
			</ul>

			{total > shown && <p className={styles.libraryText}>{t('media.library.andMore')}</p>}
		</section>
	)
}
