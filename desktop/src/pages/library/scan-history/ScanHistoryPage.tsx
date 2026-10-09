import { Link, useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useEffect, useMemo, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { formatDateTime } from '@shared/lib'
import {
	Badge,
	Button,
	Disclosure,
	EmptyState,
	Icon,
	Input,
	PageHeader,
	PageTransition,
	PhaseTransition,
	ReelLoader,
	SelectDropdown
} from '@shared/ui'

import {
	libraryScanHistoryQuery,
	type LibraryScanRunFileLog,
	type LibraryScanRunGroup,
	libraryScanRunQuery
} from '@entities/library-item'

import { LibraryExplorer, libraryExplorerModel } from '@features/library-explorer'
import { MatchFileDrawer, matchFileModel } from '@features/match-library-file'

import { FileLogItem } from './FileLogItem'
import styles from './ScanHistoryPage.module.scss'

const HISTORY_LIMIT = 50

function folderOf(relPath: string): string {
	const at = relPath.lastIndexOf('/')

	return at < 0 ? '' : relPath.slice(0, at)
}

function matchesSearch(log: LibraryScanRunFileLog, needle: string): boolean {
	return needle === '' || log.rel_path.toLowerCase().includes(needle)
}

export function ScanHistoryPage() {
	const { t, i18n } = useTranslation()
	const navigate = useNavigate()

	const [history, historyPending, startHistory, run, runPending, startRun] = useUnit([
		libraryScanHistoryQuery.$data,
		libraryScanHistoryQuery.$pending,
		libraryScanHistoryQuery.start,
		libraryScanRunQuery.$data,
		libraryScanRunQuery.$pending,
		libraryScanRunQuery.start
	])

	const [openExplorer, matchRequestedMany] = useUnit([
		libraryExplorerModel.requested,
		matchFileModel.requestedMany
	])

	const [picked, setPicked] = useState<string | null>(null)
	const [search, setSearch] = useState('')

	useEffect(() => {
		startHistory({ limit: HISTORY_LIMIT })
	}, [startHistory])

	const runs = history?.history.items ?? []

	// Until one is picked the newest scan is the one worth reading.
	const selected = picked ?? (runs[0] ? String(runs[0].id) : null)

	useEffect(() => {
		if (selected !== null) {
			startRun(Number(selected))
		}
	}, [selected, startRun])

	const detail = run?.run && String(run.run.id) === selected ? run.run : null

	const needle = search.trim().toLowerCase()

	const unmatched = useMemo(
		() => (detail?.unmatched_files ?? []).filter(log => matchesSearch(log, needle)),
		[detail, needle]
	)

	const groups = useMemo(
		() =>
			(detail?.groups ?? [])
				.filter(
					group =>
						needle === '' ||
						(group.title?.title ?? group.media_ref).toLowerCase().includes(needle) ||
						(group.files ?? []).some(log => matchesSearch(log, needle))
				)
				.sort((a, b) => (a.title?.title ?? a.media_ref).localeCompare(b.title?.title ?? b.media_ref)),
		[detail, needle]
	)

	const options = runs.map(item => ({
		value: String(item.id),
		label: formatDateTime(item.started_at, i18n.language)
	}))

	return (
		<PageTransition className={styles.root}>
			<PageHeader
				title={t('library.history.title')}
				icon={<Icon name='common/clock' size={24} />}
				subtitle={t('library.history.description')}
				breadcrumbs={[
					{ label: t('nav.library'), onSelect: () => navigate({ to: '/library' }) },
					{ label: t('library.history.title') }
				]}
			/>

			<PhaseTransition
				className={styles.body}
				phase={historyPending || runs.length > 0 ? 'history' : 'empty'}
			>
				{!historyPending && runs.length === 0 ? (
					<EmptyState title={t('library.history.empty')} />
				) : (
					<>
						<div className={styles.controls}>
							<SelectDropdown
								className={styles.select}
								options={options}
								value={selected}
								onChange={value => setPicked(value)}
							/>

							<Input
								className={styles.search}
								value={search}
								onChange={event => setSearch(event.target.value)}
								placeholder={t('library.history.search')}
								startIcon={<Icon name='common/search' size={18} />}
							/>
						</div>

						<PhaseTransition
							phase={detail ? `run:${detail.id}` : runPending ? 'loading' : 'idle'}
						>
							{!detail ? (
								runPending && (
									<div className={styles.loading}>
										<ReelLoader spinning />
									</div>
								)
							) : (
								<section className={styles.card}>
									<header className={styles.cardHeader}>
										<p className={styles.muted}>
											{t('library.history.scanned', {
												count: detail.groups?.length ?? 0
											})}
										</p>

										{detail.status === 'partial' && (
											<Badge tone='warning'>{t('library.history.partial')}</Badge>
										)}
									</header>

									{(detail.unmatched_files?.length ?? 0) > 0 && (
										<p className={styles.warning}>
											<Icon name='common/info' size={16} />
											{t('library.history.notMatched', {
												count: detail.unmatched_files?.length ?? 0
											})}
										</p>
									)}

									{unmatched.length > 0 && (
										<div className={styles.section}>
											<h4 className={styles.heading}>
												{t('library.history.unmatchedTitle')}
											</h4>

											<div className={styles.logs}>
												{unmatched.map(log => (
													<FileLogItem
														key={log.rel_path}
														log={log}
														matched={false}
														search={needle}
													/>
												))}
											</div>
										</div>
									)}

									{groups.length > 0 && (
										<div className={styles.section}>
											<h4 className={styles.heading}>
												{t('library.history.matchedTitle')}
											</h4>

											<ul className={styles.groups}>
												{groups.map(group => (
													<ScannedGroup
														key={group.media_ref}
														group={group}
														search={needle}
														onExplore={() =>
															openExplorer(
																folderOf(group.files?.[0]?.rel_path ?? '')
															)
														}
													/>
												))}
											</ul>
										</div>
									)}

									{unmatched.length === 0 && groups.length === 0 && (
										<p className={styles.muted}>{t('library.history.nothingToShow')}</p>
									)}
								</section>
							)}
						</PhaseTransition>
					</>
				)}
			</PhaseTransition>

			<LibraryExplorer onMatchMany={files => matchRequestedMany(files)} />
			<MatchFileDrawer />
		</PageTransition>
	)
}

interface ScannedGroupProps {
	group: LibraryScanRunGroup
	search: string
	onExplore: () => void
}

function ScannedGroup({ group, search, onExplore }: ScannedGroupProps) {
	const { t } = useTranslation()

	const files = group.files ?? []
	const title = group.title?.title ?? group.media_ref

	return (
		<li className={styles.group}>
			<div className={styles.groupMain}>
				<div
					className={styles.cover}
					style={{ backgroundColor: group.title?.cover_color ?? undefined }}
				>
					{group.title?.cover_image && <img src={group.title.cover_image} alt='' loading='lazy' />}
				</div>

				<div className={styles.groupBody}>
					<Link
						className={styles.groupTitle}
						to='/media/$mediaRef'
						params={{ mediaRef: group.media_ref }}
					>
						{title}
					</Link>

					<p className={group.tracked ? styles.tracked : styles.untracked}>
						<Icon name={group.tracked ? 'common/check' : 'common/close'} size={14} />
						{group.tracked
							? t('library.history.onYourList')
							: t('library.history.notYetOnYourList')}
					</p>

					<p className={styles.muted}>
						{t('library.history.filesScanned', { count: group.file_count })}
					</p>

					<div>
						<Button
							variant='ghost'
							size='small'
							startIcon={<Icon name='common/folder-tree' size={14} />}
							onClick={onExplore}
						>
							{t('library.history.openExplorer')}
						</Button>
					</div>
				</div>
			</div>

			{files.length > 0 && (
				<Disclosure
					className={styles.scannerLogs}
					summary={t('library.history.scannerLogs')}
					defaultOpen={search !== '' && files.some(log => matchesSearch(log, search))}
				>
					<div className={styles.logs}>
						{files.map(log => (
							<FileLogItem key={log.rel_path} log={log} matched search={search} />
						))}
					</div>
				</Disclosure>
			)}
		</li>
	)
}
