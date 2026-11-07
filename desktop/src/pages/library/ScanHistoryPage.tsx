import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { formatDateTime } from '@shared/lib'
import {
	EmptyState,
	Icon,
	Input,
	PageHeader,
	PageTransition,
	PhaseTransition,
	ReelLoader,
	SelectDropdown
} from '@shared/ui'

import { useNodeData } from '@infra/node'

import { libraryScanHistoryQuery, libraryScanRunQuery } from '@entities/library-item'

import { LibraryExplorer, libraryExplorerModel } from '@features/library-explorer'
import { MatchFileDrawer, matchFileModel } from '@features/match-library-file'

import styles from './ScanHistoryPage.module.scss'
import { ScanRun } from './ui/scan-run/ScanRun'

const HISTORY_LIMIT = 50

export function ScanHistoryPage() {
	const { t, i18n } = useTranslation()
	const navigate = useNavigate()

	const [history, historyPending, run, runPending] = useUnit([
		libraryScanHistoryQuery.$data,
		libraryScanHistoryQuery.$pending,
		libraryScanRunQuery.$data,
		libraryScanRunQuery.$pending
	])

	const [openExplorer, matchRequestedMany] = useUnit([
		libraryExplorerModel.requested,
		matchFileModel.requestedMany
	])

	const [picked, setPicked] = useState<string | null>(null)
	const [search, setSearch] = useState('')

	useNodeData(libraryScanHistoryQuery, { params: { limit: HISTORY_LIMIT } })

	const runs = history?.history.items ?? []

	const selected = picked ?? (runs[0] ? String(runs[0].id) : null)

	useNodeData(libraryScanRunQuery, { params: Number(selected), enabled: selected !== null })

	const detail = run?.run && String(run.run.id) === selected ? run.run : null

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
