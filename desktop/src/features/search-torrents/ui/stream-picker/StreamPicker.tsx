import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useMemo, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { Icon, Skeleton } from '@shared/ui'

import { isSeasonalRef } from '@entities/media'
import { TorrentSetupNotice } from '@entities/torrent'
import type { TorrentRelease } from '@entities/torrent'

import { applyQuickFilters, toggleQuickFilter } from '../../lib/quick-filters'
import type { QuickFilter } from '../../lib/quick-filters'
import { filterReleases } from '../../lib/releases'
import type { ReleaseKind } from '../../lib/releases'
import { sortReleases } from '../../lib/sort'
import { ALL_SOURCES, emptyReason, filterBySource, foundCount, sourceOptions } from '../../lib/sources'
import { streamEpisode } from '../../lib/stream-episode'
import type { ReleaseWatching } from '../../lib/stream-episode'
import type { ReleaseSearch } from '../../lib/useReleaseSearch'
import { useReleaseSort } from '../../lib/useReleaseSort'
import { $searchTarget } from '../../model/model'

import { EpisodePreview } from './episode-preview/EpisodePreview'
import { PickerEmpty } from './picker-empty/PickerEmpty'
import { PickerFooter } from './picker-footer/PickerFooter'
import { ReleaseFinder } from './release-finder/ReleaseFinder'
import { ReleaseRow } from './release-row/ReleaseRow'
import { ReleaseToolbar } from './release-toolbar/ReleaseToolbar'
import styles from './StreamPicker.module.scss'

export interface StreamPickerProps {
	mediaRef: string
	poster?: string | null
	search: ReleaseSearch
	watching: ReleaseWatching
}

export function StreamPicker({ mediaRef, poster, search, watching }: StreamPickerProps) {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const target = useUnit($searchTarget)
	const { setup, result, pending, criteria } = search
	const seasonal = isSeasonalRef(mediaRef)

	const [kind, setKind] = useState<ReleaseKind>('all')
	const [source, setSource] = useState(ALL_SOURCES)
	const [quick, setQuick] = useState<ReadonlySet<QuickFilter>>(new Set())
	const order = useReleaseSort()
	const [picked, setPicked] = useState<{ from: typeof result; id: string } | null>(null)

	const sources = useMemo(() => sourceOptions(result), [result])
	const shownSource = sources.some(option => option.key === source) ? source : ALL_SOURCES

	const releases = useMemo(() => {
		const byKind = filterReleases(result?.releases ?? [], { kind, onlyMissing: false, missing: null })

		return sortReleases(applyQuickFilters(filterBySource(byKind, shownSource), quick), order.sort)
	}, [result, kind, shownSource, quick, order.sort])

	const selected =
		picked && picked.from === result ? (releases.find(found => found.id === picked.id) ?? null) : null

	const wanted = {
		season: criteria.season,
		episode: criteria.episode || (target.episode ? String(target.episode) : '')
	}
	const episode = selected ? streamEpisode(selected, wanted) : null

	const stream = (release: TorrentRelease) => {
		const chosen = streamEpisode(release, wanted)

		if (chosen && !watching.busy) {
			watching.onWatch(release, chosen)
		}
	}

	return (
		<div className={styles.picker}>
			<aside className={styles.aside}>
				{target.preview && <EpisodePreview preview={target.preview} />}

				<TorrentSetupNotice
					setup={setup}
					needSearch
					onOpenSettings={() => navigate({ to: '/settings', search: { section: 'torrents' } })}
				/>

				<ReleaseFinder
					kind={kind}
					onKind={setKind}
					criteria={criteria}
					onCriteria={search.setCriteria}
					onSearch={search.run}
					sources={sources}
					source={shownSource}
					onSource={setSource}
					seasonal={seasonal}
					episodic={target.episode !== undefined}
					pending={pending}
					disabled={!setup.hasSources}
				/>
			</aside>

			<section className={styles.results}>
				<ReleaseToolbar
					order={order}
					filters={quick}
					onFilter={filter => setQuick(toggleQuickFilter(quick, filter))}
				/>

				{search.problem && (
					<p className={styles.problem}>{search.problem.detail ?? t('torrents.search.failed')}</p>
				)}
				{search.failedSources.map(failed => (
					<p key={failed.plugin ?? failed.id} className={styles.problem}>
						{t('torrents.search.sourceFailed', { name: failed.name, error: failed.error ?? '' })}
					</p>
				))}

				<div className={styles.box}>
					{pending ? (
						<ul className={styles.list}>
							{Array.from({ length: 3 }, (_, index) => (
								<li key={index}>
									<Skeleton height='7rem' radius='var(--radius)' />
								</li>
							))}
						</ul>
					) : result && releases.length === 0 ? (
						<PickerEmpty
							reason={emptyReason(result, Number(criteria.episode) || 0)}
							found={foundCount(result)}
							episode={criteria.episode}
							queries={result.queries ?? []}
							onShowAll={() => search.run({ ...criteria, episode: '' })}
						/>
					) : (
						<ul className={styles.list}>
							{releases.map(found => (
								<ReleaseRow
									key={found.id}
									release={found}
									poster={poster}
									cacheService={result?.cache_service}
									selected={selected?.id === found.id}
									onSelect={() => setPicked({ from: result, id: found.id })}
									onStream={() => stream(found)}
								/>
							))}
							{releases.length > 0 && (
								<li className={styles.tip}>
									<Icon name='common/search' size={16} className={styles.tipIcon} />
									{t(
										seasonal
											? 'torrents.search.picker.tipSeasonal'
											: 'torrents.search.picker.tip'
									)}
								</li>
							)}
						</ul>
					)}
				</div>
			</section>

			<PickerFooter
				className={styles.footer}
				selected={selected}
				playable={episode !== null}
				busy={watching.busy}
				preparing={selected !== null && watching.activeId === selected.id}
				onStream={() => selected && stream(selected)}
			/>
		</div>
	)
}
