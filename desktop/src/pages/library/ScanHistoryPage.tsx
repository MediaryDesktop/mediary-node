import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { formatDateTime } from '@shared/lib'
import {
	EmptyState,
	Icon,
	Input,
	LoadFailed,
	PageHeader,
	PageTransition,
	PhaseTransition,
	ReelLoader,
	SelectDropdown
} from '@shared/ui'

import { useNodeQuery } from '@infra/node'

import { libraryScanHistoryQuery, libraryScanRunQuery } from '@entities/library-item'

import { LibraryExplorer, libraryExplorerModel } from '@features/library-explorer'
import { MatchFileDrawer, matchFileModel } from '@features/match-library-file'

import styles from './ScanHistoryPage.module.scss'
import { ScanRun } from './ui/scan-run/ScanRun'

const HISTORY_LIMIT = 50

export function ScanHistoryPage() {
	const { t, i18n } = useTranslation()
	const navigate = useNavigate()

	const historyState = useNodeQuery(libraryScanHistoryQuery, {
		params: { limit: HISTORY_LIMIT },
		isEmpty: data => !data.history.items?.length
	})
	const [runPending, runFailed] = useUnit([libraryScanRunQuery.$pending, libraryScanRunQuery.$failed])

	const [openExplorer, matchRequestedMany] = useUnit([
		libraryExplorerModel.requested,
		matchFileModel.requestedMany
	])

	const [picked, setPicked] = useState<string | null>(null)
	const [search, setSearch] = useState('')

	const runs = historyState.data?.history.items ?? []

	const selected = picked ?? (runs[0] ? String(runs[0].id) : null)

	const runState = useNodeQuery(libraryScanRunQuery, {
		params: Number(selected),
		enabled: selected !== null
	})

	const detail = runState.data?.run && String(runState.data.run.id) === selected ? runState.data.run : null

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

			<PhaseTransition className={styles.body} phase={historyState.phase}>
				{historyState.phase === 'failed' ? (
					<LoadFailed onRetry={historyState.retry} />
				) : historyState.phase === 'empty' ? (
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
							phase={
								detail
									? `run:${detail.id}`
									: runPending
										? 'loading'
										: runFailed
											? 'failed'
											: 'idle'
							}
						>
							{!detail ? (
								runPending ? (
									<div className={styles.loading}>
										<ReelLoader spinning />
									</div>
								) : (
									runFailed && selected !== null && <LoadFailed onRetry={runState.retry} />
								)
							) : (
								<ScanRun
									run={detail}
									search={search.trim().toLowerCase()}
									onExplore={openExplorer}
								/>
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
