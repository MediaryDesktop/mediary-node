import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useMemo, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { DrawerForm, EmptyState, Skeleton, toast } from '@shared/ui'

import { isSeasonalRef } from '@entities/media'
import { TorrentSetupNotice } from '@entities/torrent'
import type { TorrentRelease } from '@entities/torrent'

import { coveredEpisodes } from '../../lib/episodes'
import { downloadRequests, filterReleases } from '../../lib/releases'
import type { ReleaseKind } from '../../lib/releases'
import { streamEpisode } from '../../lib/stream-episode'
import type { ReleaseWatching } from '../../lib/stream-episode'
import { useReleaseSearch } from '../../lib/useReleaseSearch'
import { $searchTarget, downloadReleasesFx } from '../../model/model'
import { StreamPicker } from '../stream-picker/StreamPicker'

import { ReleaseCard } from './release-card/ReleaseCard'
import { SearchBar } from './search-bar/SearchBar'
import { SearchFilters } from './search-filters/SearchFilters'
import styles from './SearchForm.module.scss'

export interface SearchFormProps {
	mediaRef: string
	title: string
	missing: number[] | null
	poster?: string | null
	watching?: ReleaseWatching
	onDone: () => void
}

export function SearchForm({ mediaRef, title, missing, poster, watching, onDone }: SearchFormProps) {
	const { t } = useTranslation()
	const navigate = useNavigate()

	const [downloading, target, downloadReleases] = useUnit([
		downloadReleasesFx.pending,
		$searchTarget,
		downloadReleasesFx
	])
	const search = useReleaseSearch(mediaRef, target)
	const { setup, result, pending, criteria } = search

	const [kind, setKind] = useState<ReleaseKind>('all')
	const [onlyMissing, setOnlyMissing] = useState(false)
	const [selected, setSelected] = useState<Set<string>>(new Set())

	const releases = useMemo(
		() => filterReleases(result?.releases ?? [], { kind, onlyMissing, missing }),
		[result, kind, onlyMissing, missing]
	)

	if (target.intent === 'watch' && watching) {
		return <StreamPicker mediaRef={mediaRef} poster={poster} search={search} watching={watching} />
	}

	const watchOf = (release: TorrentRelease) => {
		const episode = streamEpisode(release, criteria)

		return {
			possible: episode !== null && !watching?.busy,
			preparing: watching?.activeId === release.id,
			onWatch: () => episode && watching?.onWatch(release, episode),
			onCancel: () => watching?.onCancel()
		}
	}

	const run = () => {
		setSelected(new Set())
		search.run(criteria)
	}

	const toggle = (id: string, on: boolean) => {
		const next = new Set(selected)
		if (on) next.add(id)
		else next.delete(id)
		setSelected(next)
	}

	const download = async () => {
		const chosen = (result?.releases ?? []).filter(found => selected.has(found.id))
		const outcome = await downloadReleases(downloadRequests(chosen, { mediaRef, title, missing }))

		if (outcome.added > 0) {
			toast.success(t('torrents.search.addedMany', { count: outcome.added }), {
				id: 'torrent-search-add'
			})
		}
		if (outcome.failures.length > 0) {
			toast.error(outcome.failures[0] ?? t('torrents.drawer.failed'), { id: 'torrent-search-fail' })
		}
		if (outcome.failures.length === 0) {
			onDone()
		} else {
			setSelected(new Set())
		}
	}

	return (
		<DrawerForm
			onSubmit={() => void download()}
			onCancel={onDone}
			submitLabel={t('torrents.search.downloadSelected', { count: selected.size })}
			submitDisabled={selected.size === 0 || downloading}
			cancelDisabled={downloading}
			submitting={downloading}
		>
			<div className={styles.root}>
				<TorrentSetupNotice
					setup={setup}
					needSearch
					onOpenSettings={() => navigate({ to: '/settings', search: { section: 'torrents' } })}
				/>

				<SearchBar
					criteria={criteria}
					onChange={search.setCriteria}
					seasonal={isSeasonalRef(mediaRef)}
					pending={pending}
					disabled={!setup.hasSources}
					onSearch={run}
				/>

				<SearchFilters
					kind={kind}
					onKind={setKind}
					canFilterMissing={Boolean(missing?.length)}
					onlyMissing={onlyMissing}
					onOnlyMissing={setOnlyMissing}
					count={result ? releases.length : null}
				/>

				{search.problem && (
					<p className={styles.problem}>{search.problem.detail ?? t('torrents.search.failed')}</p>
				)}
				{search.failedSources.map(source => (
					<p key={source.plugin ?? source.id} className={styles.problem}>
						{t('torrents.search.sourceFailed', { name: source.name, error: source.error ?? '' })}
					</p>
				))}

				{pending ? (
					<ul className={styles.list}>
						{Array.from({ length: 4 }, (_, index) => (
							<li key={index}>
								<Skeleton height='5.25rem' radius='12px' />
							</li>
						))}
					</ul>
				) : result && releases.length === 0 ? (
					<EmptyState
						title={t('torrents.search.empty')}
						description={t('torrents.search.emptyHint')}
					/>
				) : (
					<ul className={styles.list}>
						{releases.map(found => (
							<li key={found.id}>
								<ReleaseCard
									release={found}
									covered={coveredEpisodes(found, missing)}
									poster={poster}
									cacheService={result?.cache_service}
									watch={watching ? watchOf(found) : undefined}
									checked={selected.has(found.id)}
									onCheckedChange={on => toggle(found.id, on)}
								/>
							</li>
						))}
					</ul>
				)}
			</div>
		</DrawerForm>
	)
}
