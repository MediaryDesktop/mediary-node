import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useEffect, useMemo, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { DrawerForm, EmptyState, Skeleton, toast } from '@shared/ui'

import { torrentSearchQuery, TorrentSetupNotice, useTorrentSetup } from '@entities/torrent'

import { coveredEpisodes } from '../../lib/episodes'
import { downloadRequests, filterReleases } from '../../lib/releases'
import type { ReleaseKind } from '../../lib/releases'
import { downloadReleasesFx } from '../../model/model'

import { ReleaseCard } from './release-card/ReleaseCard'
import { SearchBar } from './search-bar/SearchBar'
import type { SearchCriteria } from './search-bar/SearchBar'
import { SearchFilters } from './search-filters/SearchFilters'
import styles from './SearchForm.module.scss'

export interface SearchFormProps {
	mediaRef: string
	title: string
	missing: number[] | null
	poster?: string | null
	onDone: () => void
}

// The search, its filters and the results to tick; submitting downloads the ticked.
export function SearchForm({ mediaRef, title, missing, poster, onDone }: SearchFormProps) {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const setup = useTorrentSetup()

	const [result, error, pending, search, downloading] = useUnit([
		torrentSearchQuery.$data,
		torrentSearchQuery.$error,
		torrentSearchQuery.$pending,
		torrentSearchQuery.start,
		downloadReleasesFx.pending
	])

	const [criteria, setCriteria] = useState<SearchCriteria>({ query: '', season: '', episode: '' })
	const [kind, setKind] = useState<ReleaseKind>('all')
	const [onlyMissing, setOnlyMissing] = useState(Boolean(missing?.length))
	const [selected, setSelected] = useState<Set<string>>(new Set())

	const run = () => {
		setSelected(new Set())
		search({
			mediaRef,
			episode: Number(criteria.episode) || 0,
			season: Number(criteria.season) || 0,
			query: criteria.query
		})
	}

	// Opening the sheet is asking for releases: the first search needs no click.
	useEffect(() => {
		if (setup.loaded && setup.hasSources) {
			search({ mediaRef, episode: 0, query: '' })
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [setup.loaded, setup.hasSources, mediaRef])

	const releases = useMemo(
		() => filterReleases(result?.releases ?? [], { kind, onlyMissing, missing }),
		[result, kind, onlyMissing, missing]
	)

	const toggle = (id: string, on: boolean) => {
		const next = new Set(selected)
		if (on) next.add(id)
		else next.delete(id)
		setSelected(next)
	}

	const download = async () => {
		const chosen = (result?.releases ?? []).filter(found => selected.has(found.id))
		const outcome = await downloadReleasesFx(downloadRequests(chosen, { mediaRef, title, missing }))

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

	const problem =
		error && 'body' in error ? (error.body as { detail?: string; status?: number } | null) : null
	const failedSources = (result?.sources ?? []).filter(source => source.error)

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
					onOpenSettings={missing =>
						navigate({
							to: '/settings',
							search: { section: missing === 'client' ? 'torrent-client' : 'torrent-search' }
						})
					}
				/>

				<SearchBar
					criteria={criteria}
					onChange={setCriteria}
					seasonal={mediaRef.startsWith('tmdb:tv:')}
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

				{problem && problem.status !== 428 && (
					<p className={styles.problem}>{problem.detail ?? t('torrents.search.failed')}</p>
				)}
				{failedSources.map(source => (
					<p key={source.id} className={styles.problem}>
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
