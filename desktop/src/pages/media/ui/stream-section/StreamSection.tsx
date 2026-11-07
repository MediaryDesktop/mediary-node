import { useNavigate } from '@tanstack/react-router'
import clsx from 'clsx'
import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'
import { useStoredToggle } from '@shared/lib'
import { CollapsibleSection, Icon, Notice, RippleButton, SegmentedControl, Switch } from '@shared/ui'

import { useTorrentSetup } from '@entities/torrent'

import { searchOpened } from '@features/search-torrents'
import {
	$autoSelect,
	$streamTarget,
	$streamVia,
	autoSelectChanged,
	effectiveVia,
	streamRequested,
	streamViaChanged
} from '@features/stream-torrent'

import { EpisodeCard } from '../library-section/episode-library/to-watch-rail/EpisodeCard'
import { ToWatchRail } from '../library-section/episode-library/to-watch-rail/ToWatchRail'
import rowStyles from '../library-section/episode-row/EpisodeRow.module.scss'
import { EpisodeRowItem } from '../library-section/episode-row/EpisodeRowItem'
import sectionStyles from '../library-section/EpisodeSection.module.scss'
import { useEpisodeMeta } from '../library-section/lib/useEpisodeMeta'
import { useEpisodeText } from '../library-section/lib/useEpisodeText'

import { streamItems, upNext } from './lib/stream-items'
import type { StreamItem } from './lib/stream-items'
import styles from './StreamSection.module.scss'

const SETTINGS_OPEN_KEY = 'mediary.stream.settingsOpen'

const RAIL_SIZE = 8

export interface StreamSectionProps {
	mediaRef: string
	title: string
	mediaType: string
	cover: string | null
	coverColor: string | null
	banner: string | null
	released: number | null
	progress: number
}

export function StreamSection({
	mediaRef,
	title,
	mediaType,
	cover,
	coverColor,
	banner,
	released,
	progress
}: StreamSectionProps) {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const setup = useTorrentSetup()
	const { meta, count } = useEpisodeMeta(mediaRef)
	const text = useEpisodeText()

	const [target, request, openSearch, chosenVia, chooseVia, autoSelect, changeAutoSelect] = useUnit([
		$streamTarget,
		streamRequested,
		searchOpened,
		$streamVia,
		streamViaChanged,
		$autoSelect,
		autoSelectChanged
	])

	const via = effectiveVia(chosenVia, Boolean(setup.debrid))

	const [settingsOpen, toggleSettings] = useStoredToggle(SETTINGS_OPEN_KEY)

	const items = streamItems({
		mediaType,
		title,
		meta,
		released: released ?? count,
		labels: {
			episode: number => String(t('media.library.episode', { number })),
			seasonEpisode: (season, number) => String(t('media.library.seasonEpisode', { season, number }))
		}
	})
	const toWatch = upNext(items, progress, RAIL_SIZE)
	const fallback = banner ?? cover
	const busy = target !== null

	const play = (item: StreamItem) => {
		if (autoSelect) {
			request({
				key: `${mediaRef}/${item.key}`,
				label: mediaType === 'movie' ? title : `${title} · ${item.label}`,
				params: {
					media_ref: mediaRef,
					title,
					episode: item.episode,
					season: item.season,
					auto: true,
					via
				}
			})
		} else {
			openSearch({ episode: item.episode, season: item.season, intent: 'watch' })
		}
	}

	return (
		<section className={sectionStyles.section}>
			{setup.loaded && !setup.hasSources && (
				<Notice
					className={styles.setupNotice}
					tone='warning'
					title={t('torrents.setup.noSources')}
					actionLabel={t('torrents.setup.openSettings')}
					onAction={() => navigate({ to: '/settings', search: { section: 'torrents' } })}
				>
					{t('torrents.setup.noSourcesHint')}
				</Notice>
			)}

			<section className={styles.card}>
				<RippleButton
					className={styles.head}
					aria-expanded={settingsOpen}
					aria-controls='stream-settings-body'
					onClick={toggleSettings}
				>
					<span className={styles.headIcon}>
						<Icon name='common/settings' size={18} />
					</span>

					<span className={styles.headText}>
						<span className={styles.headTitle}>{t('media.stream.settings')}</span>
						<span className={styles.headSubtitle}>{t('media.stream.settingsHint')}</span>
					</span>

					<span className={clsx(styles.chevron, settingsOpen && styles.chevronOpen)} aria-hidden>
						<Icon name='common/chevron-down' size={18} />
					</span>
				</RippleButton>

				<CollapsibleSection open={settingsOpen}>
					<div id='stream-settings-body' className={styles.body}>
						<div className={styles.info}>
							<Icon name='common/info' size={18} className={styles.infoIcon} />
							<p>{t('media.stream.explain')}</p>
						</div>

						{!setup.debrid && (
							<Notice
								title={t('media.stream.debridPitch')}
								actionLabel={t('torrents.setup.openSettings')}
								onAction={() =>
									navigate({ to: '/settings', search: { section: 'torrents' } })
								}
							>
								{t('media.stream.debridPitchHint')}
							</Notice>
						)}

						<div className={styles.toolbar}>
							{setup.debrid && (
								<>
									<SegmentedControl
										label={t('media.stream.via')}
										items={[
											{ value: 'embedded', label: t('media.stream.viaBuiltIn') },
											{ value: 'debrid', label: setup.debrid.name }
										]}
										value={via}
										onValueChange={chooseVia}
									/>
									<span className={styles.divider} aria-hidden />
								</>
							)}
							<Switch
								checked={autoSelect}
								onChange={changeAutoSelect}
								label={t('media.stream.autoSelect')}
							/>
							<p className={styles.hint}>
								{!autoSelect
									? t('media.stream.manualHint')
									: via === 'embedded'
										? t('media.stream.autoSelectBuiltInHint')
										: t('media.stream.autoSelectHint', {
												service: setup.debrid?.name ?? ''
											})}
							</p>
						</div>
					</div>
				</CollapsibleSection>
			</section>

			{toWatch.length > 0 && (
				<ToWatchRail>
					{toWatch.map(item => (
						<EpisodeCard
							key={item.key}
							label={item.label}
							name={text.name(item.meta)}
							of={!meta.seasonal && item.episode !== undefined ? released : null}
							images={[item.meta?.image, fallback]}
							coverColor={coverColor}
							disabled={busy || !setup.hasSources}
							onPlay={() => play(item)}
						/>
					))}
				</ToWatchRail>
			)}

			<ul className={rowStyles.episodes}>
				{items.map(item => (
					<EpisodeRowItem
						key={item.key}
						label={item.label}
						name={text.name(item.meta)}
						duration={text.minutes(null, item.meta)}
						episode={item.meta}
						images={[item.meta?.image, fallback]}
						coverColor={coverColor}
						watched={item.position <= progress}
						disabled={busy || !setup.hasSources}
						onPlay={() => play(item)}
					/>
				))}
			</ul>
		</section>
	)
}
