import * as Menu from '@radix-ui/react-dropdown-menu'
import clsx from 'clsx'
import { useStoreMap, useUnit } from 'effector-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { Icon, useRipple } from '@shared/ui'

import { useCardHold } from '@entities/media'
import { playbackModel } from '@entities/playback'

import { playList } from '../../lib/play-list'
import type { PlayEntry } from '../../lib/play-list'
import { usePlayFile } from '../../lib/useContinueWatching'
import { $titleEpisodes, $titleFiles, titlePlayRequested } from '../../model/title-play'

import { EpisodeItem } from './episode-item/EpisodeItem'
import { PlayerModeMenu } from './player-mode-menu/PlayerModeMenu'
import styles from './PlayMenu.module.scss'

export interface PlayMenuProps {
	mediaRef: string
	label: string
	progress: number
	hasTrailer?: boolean
	onOpen?: () => void
	onDownload?: () => void
	onTrailer?: () => void
	onMarkWatched?: (episode: number) => void
	onStream?: (entry: PlayEntry | null) => void
	onDownloadEpisode?: (entry: PlayEntry) => void
	busy?: boolean
}

export function PlayMenu({
	mediaRef,
	label,
	progress,
	hasTrailer = false,
	onOpen,
	onDownload,
	onTrailer,
	onMarkWatched,
	onStream,
	onDownloadEpisode,
	busy = false
}: PlayMenuProps) {
	const { t } = useTranslation()
	const hold = useCardHold()
	const { play, starting } = usePlayFile()
	const nextRef = useRef<HTMLDivElement>(null)
	const splitRef = useRef<HTMLDivElement>(null)
	const pointerActiveRef = useRef(false)
	const [width, setWidth] = useState<number | undefined>(undefined)
	const mainRipple = useRipple<HTMLButtonElement>({ disabled: starting || busy })
	const chevronRipple = useRipple<HTMLButtonElement>()

	const [request, playExternally] = useUnit([titlePlayRequested, playbackModel.playRequested])

	const files = useStoreMap({
		store: $titleFiles,
		keys: [mediaRef],
		fn: (all, [ref]) => all[ref] ?? null
	})
	const episodes = useStoreMap({
		store: $titleEpisodes,
		keys: [mediaRef],
		fn: (all, [ref]) => all[ref] ?? null
	})

	useEffect(() => {
		request(mediaRef)
	}, [mediaRef, request])

	const list = useMemo(
		() => playList(mediaRef, files ?? [], episodes ?? [], progress),
		[mediaRef, files, episodes, progress]
	)

	const [open, setOpen] = useState(false)
	const [episodesOpen, setEpisodesOpen] = useState(false)
	const [season, setSeason] = useState<number | null>(null)

	const { next, first } = list
	const shownSeason = season ?? next?.season ?? first?.season ?? null
	const shown = list.seasonal ? list.entries.filter(entry => entry.season === shownSeason) : list.entries
	const target = next?.file ?? first?.file ?? null

	useEffect(() => {
		if (episodesOpen) {
			nextRef.current?.scrollIntoView({ block: 'center' })
		}
	}, [episodesOpen, shownSeason])

	const changeOpen = (value: boolean) => {
		if (value) {
			setWidth(splitRef.current?.offsetWidth)
		}

		setOpen(value)
		hold(value)

		if (!value) {
			setSeason(null)
		}
	}

	const playEntry = (entry: PlayEntry | null) => {
		if (entry?.file) {
			play(entry.file.id)
		} else if (onStream) {
			onStream(entry)
		} else if (onDownload) {
			onDownload()
		} else {
			onOpen?.()
		}
	}

	const downloadEntry = onDownloadEpisode
		? (entry: PlayEntry) => {
				changeOpen(false)
				onDownloadEpisode(entry)
			}
		: undefined

	const skipFocusReturn = (event: Event) => {
		if (pointerActiveRef.current) {
			event.preventDefault()
		}
	}

	const mainLabel = next ? t('media.card.play', { episode: next.number }) : label

	return (
		<div
			ref={splitRef}
			className={clsx(styles.split, open && styles.open)}
			onPointerDownCapture={() => {
				pointerActiveRef.current = true
			}}
			onKeyDownCapture={() => {
				pointerActiveRef.current = false
			}}
		>
			<button
				ref={mainRipple}
				type='button'
				className={styles.main}
				disabled={starting || busy}
				onClick={() => playEntry(next)}
			>
				<Icon name='common/play' size={14} />
				<span className={styles.label}>{mainLabel}</span>
			</button>

			<span className={styles.divider} aria-hidden />

			<Menu.Root open={open} onOpenChange={changeOpen}>
				<Menu.Trigger asChild>
					<button
						ref={chevronRipple}
						type='button'
						className={styles.chevron}
						aria-label={t('media.card.menu.more')}
					>
						<Icon name='common/chevron-down' size={16} />
					</button>
				</Menu.Trigger>

				<Menu.Portal>
					<Menu.Content
						className={styles.menu}
						side='bottom'
						align='end'
						sideOffset={6}
						collisionPadding={12}
						style={{ width }}
						onCloseAutoFocus={skipFocusReturn}
					>
						{list.entries.length > 1 && (
							<Menu.Sub open={episodesOpen} onOpenChange={setEpisodesOpen}>
								<Menu.SubTrigger className={styles.item}>
									<Icon name='common/list' size={16} className={styles.icon} />
									<span className={styles.text}>{t('media.card.menu.selectEpisode')}</span>
									<Icon name='common/chevron-down' size={14} className={styles.subArrow} />
								</Menu.SubTrigger>

								<Menu.Portal>
									<Menu.SubContent
										className={clsx(styles.menu, styles.episodes)}
										sideOffset={8}
										collisionPadding={12}
									>
										{list.seasons.length > 1 && (
											<div className={styles.seasons}>
												{list.seasons.map(number => (
													<Menu.Item
														key={number}
														className={clsx(
															styles.season,
															number === shownSeason && styles.current
														)}
														onSelect={event => {
															event.preventDefault()
															setSeason(number)
														}}
													>
														{t('media.card.menu.season', { number })}
													</Menu.Item>
												))}
											</div>
										)}

										<div className={styles.list}>
											{shown.map(entry => (
												<EpisodeItem
													key={entry.key}
													ref={entry === next ? nextRef : undefined}
													entry={entry}
													isNext={entry === next}
													onPlay={playEntry}
													onDownload={downloadEntry}
												/>
											))}
										</div>

										{onOpen && (
											<>
												<Menu.Separator className={styles.separator} />
												<Menu.Item className={styles.item} onSelect={onOpen}>
													<span className={styles.text}>
														{t('media.card.menu.showAll')}
													</span>
												</Menu.Item>
											</>
										)}
									</Menu.SubContent>
								</Menu.Portal>
							</Menu.Sub>
						)}

						<Menu.Item
							className={styles.item}
							disabled={!first?.file && !onStream}
							onSelect={() => playEntry(first)}
						>
							<Icon name='common/reset' size={16} className={styles.icon} />
							<span className={styles.text}>{t('media.card.menu.playFromStart')}</span>
						</Menu.Item>

						{hasTrailer && onTrailer && (
							<Menu.Item className={styles.item} onSelect={onTrailer}>
								<Icon name='common/clapperboard' size={16} className={styles.icon} />
								<span className={styles.text}>{t('media.card.menu.playTrailer')}</span>
							</Menu.Item>
						)}

						<Menu.Separator className={styles.separator} />

						<Menu.Item
							className={styles.item}
							disabled={!target}
							onSelect={() => target && playExternally(target.id)}
						>
							<Icon name='common/external-link' size={16} className={styles.icon} />
							<span className={styles.text}>{t('media.card.menu.playExternal')}</span>
						</Menu.Item>

						<PlayerModeMenu />

						{next && onMarkWatched && (
							<>
								<Menu.Separator className={styles.separator} />
								<Menu.Item
									className={styles.item}
									onSelect={() => onMarkWatched(next.position)}
								>
									<Icon name='common/check-circle-2' size={16} className={styles.icon} />
									<span className={styles.text}>
										{t('media.card.menu.markWatched', { episode: next.number })}
									</span>
								</Menu.Item>
							</>
						)}
					</Menu.Content>
				</Menu.Portal>
			</Menu.Root>
		</div>
	)
}
