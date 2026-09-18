import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { useTranslation } from '@shared/i18n'
import { PageTransition } from '@shared/ui'

import { SearchFilters, searchMediaModel, SearchResults, SearchToolbar } from '@features/search-media'

import styles from './CatalogPage.module.scss'

export function CatalogPage() {
	const { t } = useTranslation()

	const [title, filtersOpen, total, pageOpened] = useUnit([
		searchMediaModel.$title,
		searchMediaModel.$filtersOpen,
		searchMediaModel.$total,
		searchMediaModel.pageOpened
	])

	useEffect(() => {
		pageOpened()
	}, [pageOpened])

	return (
		<PageTransition className={styles.root}>
			<header className={styles.header}>
				<h1 className={styles.title}>
					{title.trim() ? t('catalog.heading.results') : t('catalog.heading.popular')}
				</h1>

				{total > 0 && <span className={styles.total}>{t('catalog.total', { count: total })}</span>}
			</header>

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
