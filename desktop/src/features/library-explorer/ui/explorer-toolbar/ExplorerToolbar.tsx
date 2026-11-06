import type { ReactNode } from 'react'
import { FaFilter } from 'react-icons/fa6'
import { LuFolderSync } from 'react-icons/lu'

import { useTranslation } from '@shared/i18n'
import { Button, DropdownMenu, Icon } from '@shared/ui'

import { EXPLORER_FILTERS } from '../../lib/build-tree'
import type { ExplorerFilter } from '../../lib/build-tree'

import styles from './ExplorerToolbar.module.scss'

export interface ExplorerToolbarProps {
	unmatchedCount: number
	filter: ExplorerFilter | null
	onFilter: (filter: ExplorerFilter | null) => void
	selecting: boolean
	onToggleSelecting: () => void
	refreshing: boolean
	onRefresh: () => void
	selectionActions?: ReactNode
}

export function ExplorerToolbar({
	unmatchedCount,
	filter,
	onFilter,
	selecting,
	onToggleSelecting,
	refreshing,
	onRefresh,
	selectionActions
}: ExplorerToolbarProps) {
	const { t } = useTranslation()

	return (
		<div className={styles.toolbar}>
			{unmatchedCount > 0 && (
				<button type='button' className={styles.pill} onClick={() => onFilter('unmatched')}>
					<Icon name='common/info' size={14} />
					{t('library.explorer.unmatchedPill', { count: unmatchedCount })}
				</button>
			)}

			<span className={styles.spacer} />

			{selectionActions}

			{filter === null ? (
				<DropdownMenu
					align='end'
					items={EXPLORER_FILTERS.map(preset => ({
						id: preset,
						label: t(`library.explorer.filter.${preset}`),
						onSelect: () => onFilter(preset)
					}))}
					trigger={
						<Button variant='secondary' size='small' startIcon={<FaFilter size={16} />}>
							{t('library.explorer.filterAction')}
						</Button>
					}
				/>
			) : (
				<Button
					variant='primary'
					size='small'
					startIcon={<Icon name='common/close' size={16} />}
					className={styles.pulse}
					onClick={() => onFilter(null)}
				>
					{t('library.explorer.filterActive', { filter: t(`library.explorer.filter.${filter}`) })}
				</Button>
			)}

			<Button
				variant={selecting ? 'primary' : 'secondary'}
				size='small'
				startIcon={<Icon name='common/list-checks' size={16} />}
				className={selecting ? styles.pulse : undefined}
				onClick={onToggleSelecting}
			>
				{selecting ? t('library.explorer.selecting') : t('library.explorer.select')}
			</Button>

			<Button
				variant='secondary'
				size='small'
				iconOnly
				loading={refreshing}
				aria-label={t('library.explorer.refresh')}
				onClick={onRefresh}
			>
				<LuFolderSync size={16} />
			</Button>
		</div>
	)
}
