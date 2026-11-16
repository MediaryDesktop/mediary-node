import * as Menu from '@radix-ui/react-dropdown-menu'
import clsx from 'clsx'
import { useStoreMap, useUnit } from 'effector-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent, PointerEvent } from 'react'

import { useTranslation } from '@shared/i18n'
import { Icon } from '@shared/ui'

import { episodeTitle, useCardHold } from '@entities/media'
import { $playerMode, playbackModel, PLAYER_MODES, playerModeChanged } from '@entities/playback'
import type { PlayerMode } from '@entities/playback'

import { playList } from '../../lib/play-list'
import type { PlayEntry } from '../../lib/play-list'
import { usePlayFile } from '../../lib/useContinueWatching'
import { $titleEpisodes, $titleFiles, titlePlayRequested } from '../../model/title-play'

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
	const { t, i18n } = useTranslation()
	const hold = useCardHold()
	const { play, starting } = usePlayFile()
	const nextRef = useRef<HTMLDivElement>(null)
	const splitRef = useRef<HTMLDivElement>(null)
	const [width, setWidth] = useState<number | undefined>(undefined)

	const [request, playExternally, playerMode, changePlayerMode] = useUnit([
		titlePlayRequested,
		playbackModel.playRequested,
		$playerMode,
		playerModeChanged
	])

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

	const downloadEntry = (event: MouseEvent, entry: PlayEntry) => {
		event.preventDefault()
		event.stopPropagation()
		changeOpen(false)
		onDownloadEpisode?.(entry)
	}

	const keepFromItem = (event: PointerEvent) => event.stopPropagation()

	const mainLabel = next ? t('media.card.play', { episode: next.number }) : label

	const entryTitle = (entry: PlayEntry) =>
		(entry.episode ? episodeTitle(entry.episode, i18n.language) : null) ??
		t('media.card.menu.episode', { number: entry.number })

	return (
		<div ref={splitRef} className={clsx(styles.split, open && styles.open)}>
			<button
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
					<button type='button' className={styles.chevron} aria-label={t('media.card.menu.more')}>
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
											{shown.map(entry => {
												const isNext = entry === next

												return (
													<Menu.Item
														key={entry.key}
														ref={isNext ? nextRef : undefined}
														className={clsx(
															styles.item,
															styles.episode,
															isNext && styles.next,
															!entry.file && styles.absent
														)}
														onSelect={() => playEntry(entry)}
													>
														<span className={styles.number}>{entry.number}</span>
														<span className={styles.text}>
															{entryTitle(entry)}
														</span>

														{isNext && (
															<span className={styles.tag}>
																{t('media.card.menu.next')}
															</span>
														)}

														{entry.watched ? (
															<Icon
																name='common/check'
																size={14}
																className={styles.aside}
															/>
														) : !entry.file && onDownloadEpisode ? (
															<button
																type='button'
																tabIndex={-1}
																className={styles.download}
																aria-label={t('media.card.menu.download', {
																	label: entryTitle(entry)
																})}
																title={t('media.card.menu.download', {
																	label: entryTitle(entry)
																})}
																onPointerDown={keepFromItem}
																onPointerUp={keepFromItem}
																onClick={event => downloadEntry(event, entry)}
															>
																<Icon name='common/download' size={14} />
															</button>
														) : entry.episode?.runtime_minutes ? (
															<span className={styles.aside}>
																{t('media.library.minutes', {
																	count: entry.episode.runtime_minutes
																})}
															</span>
														) : null}
													</Menu.Item>
												)
											})}
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

						<Menu.Sub>
							<Menu.SubTrigger className={styles.item}>
								<Icon name='common/player' size={16} className={styles.icon} />
								<span className={styles.text}>{t('media.card.menu.player')}</span>
								<span className={styles.value}>
									{t(`settings.player.modes.${playerMode}`)}
								</span>
							</Menu.SubTrigger>

							<Menu.Portal>
								<Menu.SubContent className={styles.menu} sideOffset={8} collisionPadding={12}>
									<Menu.RadioGroup
										value={playerMode}
										onValueChange={value => changePlayerMode(value as PlayerMode)}
									>
										{PLAYER_MODES.map(mode => (
											<Menu.RadioItem
												key={mode}
												value={mode}
												className={styles.item}
												onSelect={event => event.preventDefault()}
											>
												<span className={styles.text}>
													{t(`settings.player.modes.${mode}`)}
												</span>
												<Menu.ItemIndicator className={styles.aside}>
													<Icon name='common/check' size={14} />
												</Menu.ItemIndicator>
											</Menu.RadioItem>
										))}
									</Menu.RadioGroup>
								</Menu.SubContent>
							</Menu.Portal>
						</Menu.Sub>

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
