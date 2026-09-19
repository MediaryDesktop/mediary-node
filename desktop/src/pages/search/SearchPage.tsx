import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { useTranslation } from '@shared/i18n'
import { PageTransition } from '@shared/ui'

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
			<h1 className={styles.title}>{t('nav.search')}</h1>

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
