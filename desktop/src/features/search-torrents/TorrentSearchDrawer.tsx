import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'
import { Badge, Drawer } from '@shared/ui'

import { summarizeEpisodes } from './lib/episodes'
import { $searchOpen, searchClosed } from './model/model'
import styles from './TorrentSearchDrawer.module.scss'
import { SearchForm } from './ui/search-form/SearchForm'

export interface TorrentSearchDrawerProps {
	mediaRef: string
	// The title's name; it also names the folder downloads go into.
	title: string
	// The episodes out that the library lacks; null when the count is unknown.
	missing: number[] | null
	poster?: string | null
}

// Search for a title's releases in a sheet, as Seanime does it: the missing
// episodes on top, the results below to tick, one button to download them. A
// batch only brings the episodes that are missing.
export function TorrentSearchDrawer({ mediaRef, title, missing, poster }: TorrentSearchDrawerProps) {
	const { t } = useTranslation()

	const [open, close] = useUnit([$searchOpen, searchClosed])

	return (
		<Drawer
			open={open}
			onOpenChange={next => !next && close()}
			title={t('torrents.search.drawerTitle')}
			description={
				<span className={styles.descriptionRow}>
					{title}
					{missing && (
						<Badge tone={missing.length > 0 ? 'warning' : 'success'}>
							{missing.length > 0
								? summarizeEpisodes(missing)
								: t('torrents.search.nothingMissing')}
						</Badge>
					)}
				</span>
			}
			side='bottom'
			size='sheet'
		>
			{open && (
				<SearchForm
					mediaRef={mediaRef}
					title={title}
					missing={missing}
					poster={poster}
					onDone={close}
				/>
			)}
		</Drawer>
	)
}
