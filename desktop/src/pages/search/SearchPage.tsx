import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon, PageHeader, PageTransition } from '@shared/ui'

import { aniListAccountModel } from '@entities/anilist-account'
import { mediaTitle } from '@entities/media'
import { canTrack } from '@entities/tracker'

import { manualMediaModel } from '@features/manage-manual-media'
import { SearchFilters, searchMediaModel, SearchResults, SearchToolbar } from '@features/search-media'
import { EntryMenu } from '@features/track-media'

import styles from './SearchPage.module.scss'

export function SearchPage() {
	const { t } = useTranslation()

	const [filtersOpen, title, filters, pageOpened, connected, manualRequested] = useUnit([
		searchMediaModel.$filtersOpen,
		searchMediaModel.$title,
		searchMediaModel.$filters,
		searchMediaModel.pageOpened,
		aniListAccountModel.$connected,
		manualMediaModel.createRequested
	])

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
					<SearchResults
						// Anime and manga lists live in AniList and need the account; movies
						// and shows go on the node's own list.
						renderMenu={(media, entry) =>
							canTrack(media.media_type, connected) ? (
								<EntryMenu
									media={{
										mediaRef: media.media_ref,
										mediaType: media.media_type,
										title: mediaTitle(media.title),
										siteUrl: media.site_url
									}}
									entry={entry}
								/>
							) : null
						}
						manualAction={
							title.trim() !== '' ? (
								<Button
									variant='secondary'
									size='small'
									startIcon={<Icon name='common/plus' size={16} />}
									onClick={() => manualRequested({ mediaType: filters.type, title })}
								>
									{t('manualMedia.notFoundHint')}
								</Button>
							) : undefined
						}
					/>
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
