import { useTranslation } from '@shared/i18n'
import { Checkbox, SelectionGroup } from '@shared/ui'

import type { ReleaseKind } from '../../../lib/releases'

import styles from './SearchFilters.module.scss'

export interface SearchFiltersProps {
	kind: ReleaseKind
	onKind: (kind: ReleaseKind) => void
	// The "only missing" switch shows only when something is missing.
	canFilterMissing: boolean
	onlyMissing: boolean
	onOnlyMissing: (on: boolean) => void
	// How many releases pass, or null before the first answer.
	count: number | null
}

export function SearchFilters({
	kind,
	onKind,
	canFilterMissing,
	onlyMissing,
	onOnlyMissing,
	count
}: SearchFiltersProps) {
	const { t } = useTranslation()

	return (
		<div className={styles.filters}>
			<SelectionGroup
				options={[
					{ value: 'all', label: t('torrents.search.kind.all') },
					{ value: 'episodes', label: t('torrents.search.kind.episodes') },
					{ value: 'batches', label: t('torrents.search.kind.batches') }
				]}
				value={kind}
				onValueChange={onKind}
				label={t('torrents.search.kind.label')}
			/>
			{canFilterMissing && (
				<label className={styles.toggle}>
					<Checkbox
						checked={onlyMissing}
						onCheckedChange={onOnlyMissing}
						label={t('torrents.search.onlyMissing')}
					/>
					{t('torrents.search.onlyMissing')}
				</label>
			)}
			{count !== null && (
				<span className={styles.count}>{t('torrents.search.results', { count })}</span>
			)}
		</div>
	)
}
