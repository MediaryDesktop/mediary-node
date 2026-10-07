import { useNavigate } from '@tanstack/react-router'
import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useEffect, useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'

import { useTranslation } from '@shared/i18n'
import { formatBytes, formatRelativeTime } from '@shared/lib'
import {
	Badge,
	Button,
	Checkbox,
	Drawer,
	DrawerForm,
	EmptyState,
	Icon,
	Input,
	SelectionGroup,
	Skeleton,
	toast
} from '@shared/ui'

import { torrentSearchQuery, TorrentSetupNotice, useTorrentSetup } from '@entities/torrent'
import type { AddTorrentParams } from '@entities/torrent'

import { coveredEpisodes, summarizeEpisodes } from './lib/episodes'
import { $searchOpen, downloadReleasesFx, searchClosed } from './model'
import styles from './TorrentSearchDrawer.module.scss'

export interface TorrentSearchDrawerProps {
	mediaRef: string
	// The title's name; it also names the folder downloads go into.
	title: string
	// The episodes out that the library lacks; null when the count is unknown.
	missing: number[] | null
}

type Kind = 'all' | 'episodes' | 'batches'

// Search for a title's releases in a sheet, as Seanime does it: the missing
// episodes on top, the results below to tick, one button to download them. A
// batch only brings the episodes that are missing.
export function TorrentSearchDrawer({ mediaRef, title, missing }: TorrentSearchDrawerProps) {
	const { t } = useTranslation()

	const [open, close] = useUnit([$searchOpen, searchClosed])

	return (
		<Drawer
			open={open}
			onOpenChange={next => !next && close()}
			title={t('torrents.search.drawerTitle')}
			description={title}
			side='bottom'
			size='sheet'
		>
			{open && <SearchForm mediaRef={mediaRef} title={title} missing={missing} onDone={close} />}
		</Drawer>
	)
}

function SearchForm({ mediaRef, title, missing, onDone }: TorrentSearchDrawerProps & { onDone: () => void }) {
	const { t, i18n } = useTranslation()
	const navigate = useNavigate()
	const setup = useTorrentSetup()

	const [result, error, pending, search, downloading] = useUnit([
		torrentSearchQuery.$data,
		torrentSearchQuery.$error,
		torrentSearchQuery.$pending,
		torrentSearchQuery.start,
		downloadReleasesFx.pending
	])

	const [query, setQuery] = useState('')
	const [episode, setEpisode] = useState('')
	const [kind, setKind] = useState<Kind>('all')
	const [onlyMissing, setOnlyMissing] = useState(Boolean(missing?.length))
	const [selected, setSelected] = useState<Set<string>>(new Set())

	const run = () => {
		setSelected(new Set())
		search({ mediaRef, episode: Number(episode) || 0, query })
	}

	// Opening the sheet is asking for releases: the first search needs no click.
	useEffect(() => {
		if (setup.loaded && setup.hasSources) {
			search({ mediaRef, episode: 0, query: '' })
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [setup.loaded, setup.hasSources, mediaRef])

	const releases = useMemo(() => {
		return (result?.releases ?? []).filter(found => {
			if (kind === 'episodes' && found.batch) return false
			if (kind === 'batches' && !found.batch) return false
			if (onlyMissing && missing?.length && coveredEpisodes(found, missing).length === 0) return false
			return true
		})
	}, [result, kind, onlyMissing, missing])

	const toggle = (id: string, on: boolean) => {
		const next = new Set(selected)
		if (on) next.add(id)
		else next.delete(id)
		setSelected(next)
	}

	const download = async () => {
		const chosen = (result?.releases ?? []).filter(found => selected.has(found.id))

		const items: AddTorrentParams[] = chosen.map(found => {
			const covered = coveredEpisodes(found, missing)
			const single = found.episodes && found.episodes.from === found.episodes.to

			return {
				media_ref: mediaRef,
				title,
				release_id: found.id,
				episodes: covered.length > 0 ? covered : single ? [found.episodes!.from] : undefined,
				// A batch is held until its file list arrives: with the missing
				// episodes known the node takes their files itself, otherwise the
				// user picks them.
				choose_files: found.batch
			}
		})

		const outcome = await downloadReleasesFx(items)

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

	// The sheet is itself a form whose submit downloads; Enter in a search field
	// searches instead.
	const searchOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === 'Enter') {
			event.preventDefault()
			run()
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

				{missing && (
					<p className={styles.missing}>
						{missing.length > 0 ? (
							<>
								<strong>{t('torrents.search.missing')}</strong> {summarizeEpisodes(missing)}
							</>
						) : (
							t('torrents.search.nothingMissing')
						)}
					</p>
				)}

				<div className={styles.bar}>
					<Input
						value={query}
						onChange={event => setQuery(event.target.value)}
						onKeyDown={searchOnEnter}
						placeholder={t('torrents.search.placeholder')}
						startIcon={<Icon name='common/search' size={16} />}
						className={styles.query}
						aria-label={t('torrents.search.placeholder')}
					/>
					<Input
						type='number'
						min={0}
						value={episode}
						onChange={event => setEpisode(event.target.value)}
						onKeyDown={searchOnEnter}
						placeholder={t('torrents.search.episode')}
						className={styles.episode}
						aria-label={t('torrents.search.episode')}
					/>
					<Button loading={pending} disabled={!setup.hasSources} onClick={run}>
						{t('torrents.search.submit')}
					</Button>
				</div>

				<div className={styles.filters}>
					<SelectionGroup
						options={[
							{ value: 'all', label: t('torrents.search.kind.all') },
							{ value: 'episodes', label: t('torrents.search.kind.episodes') },
							{ value: 'batches', label: t('torrents.search.kind.batches') }
						]}
						value={kind}
						onValueChange={setKind}
						label={t('torrents.search.kind.label')}
					/>
					{Boolean(missing?.length) && (
						<label className={styles.toggle}>
							<Checkbox
								checked={onlyMissing}
								onCheckedChange={setOnlyMissing}
								label={t('torrents.search.onlyMissing')}
							/>
							{t('torrents.search.onlyMissing')}
						</label>
					)}
					{result && (
						<span className={styles.count}>
							{t('torrents.search.results', { count: releases.length })}
						</span>
					)}
				</div>

				{problem && problem.status !== 428 && (
					<p className={styles.problem}>{problem.detail ?? t('torrents.search.failed')}</p>
				)}
				{failedSources.map(source => (
					<p key={source.id} className={styles.problem}>
						{t('torrents.search.sourceFailed', { name: source.name, error: source.error ?? '' })}
					</p>
				))}

				{pending && !result ? (
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
						{releases.map(found => {
							const covered = coveredEpisodes(found, missing)
							const checked = selected.has(found.id)

							return (
								<li key={found.id}>
									<label
										className={clsx(
											styles.card,
											checked && styles.checked,
											!found.eligible && styles.ineligible
										)}
									>
										<Checkbox
											checked={checked}
											onCheckedChange={on => toggle(found.id, on)}
											label={found.title}
											className={styles.check}
										/>

										<div className={styles.body}>
											<span className={styles.episodeLabel}>
												{found.episodes
													? found.episodes.from === found.episodes.to
														? t('torrents.files.episode', {
																number: found.episodes.from
															})
														: t('torrents.search.episodes', {
																from: found.episodes.from,
																to: found.episodes.to
															})
													: t('torrents.search.noEpisode')}
											</span>
											<p className={styles.name} title={found.title}>
												{found.title}
											</p>
											<div className={styles.meta}>
												<span className={styles.seeds}>↑ {found.seeders}</span>
												<span>↓ {found.peers}</span>
												{found.size > 0 && <span>{formatBytes(found.size)}</span>}
												{found.published_at && (
													<span>
														{formatRelativeTime(
															found.published_at,
															i18n.language,
															{
																maxUnit: 'year'
															}
														)}
													</span>
												)}
												<span>{found.indexer || found.source_name}</span>
											</div>
										</div>

										<div className={styles.badges}>
											{found.best && (
												<Badge tone='warning' icon='common/star'>
													{t('torrents.search.best')}
												</Badge>
											)}
											{covered.length > 0 && (
												<Badge tone='success'>
													{t('torrents.search.covers', { count: covered.length })}
												</Badge>
											)}
											{found.resolution && <Badge>{found.resolution}</Badge>}
											{found.codec && <Badge>{found.codec}</Badge>}
											{found.group && <Badge tone='accent'>{found.group}</Badge>}
										</div>

										{found.page_url && (
											<button
												type='button'
												className={styles.page}
												aria-label={t('torrents.search.page')}
												title={t('torrents.search.page')}
												onClick={event => {
													event.preventDefault()
													window.open(found.page_url, '_blank', 'noreferrer')
												}}
											>
												<Icon name='common/external-link' size={16} />
											</button>
										)}
									</label>
								</li>
							)
						})}
					</ul>
				)}
			</div>
		</DrawerForm>
	)
}
