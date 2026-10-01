import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { useTranslation } from '@shared/i18n'
import { Icon, PageHeader, PageTransition } from '@shared/ui'

import { SearchFilters, searchMediaModel, SearchResults, SearchToolbar } from '@features/search-media'

import styles from './SearchPage.module.scss'

export function SearchPage() {
	const { t } = useTranslation()

	const [filtersOpen, pageOpened] = useUnit([searchMediaModel.$filtersOpen, searchMediaModel.pageOpened])

	useEffect(() => {
		pageOpened()
	}, [pageOpened])

	return (
		<PageTransition className={styles.root}>
			<PageHeader
				title={t('nav.search')}
				icon={<Icon name='common/search' size={28} />}
				subtitle={t('search.subtitle')}
			/>

			<SearchToolbar />

			<div className={clsx(styles.layout, filtersOpen && styles.withFilters)}>
				<div className={styles.results}>
					<SearchResults />
				</div>

				<aside className={styles.filters} inert={!filtersOpen}>
					<div className={styles.filtersInner}>
						<SearchFilters />
					</div>
				</aside>
			</div>
		</PageTransition>
	)
}
