import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'
import { Badge, Drawer } from '@shared/ui'

import { summarizeEpisodes } from './lib/episodes'
import type { ReleaseWatching } from './lib/stream-episode'
import { $searchOpen, $searchTarget, searchClosed } from './model/model'
import styles from './TorrentSearchDrawer.module.scss'
import { SearchForm } from './ui/search-form/SearchForm'

export interface TorrentSearchDrawerProps {
	mediaRef: string
	// The title's name; it also names the folder downloads go into.
	title: string
	// The episodes out that the library lacks; null when the count is unknown.
	missing: number[] | null
	poster?: string | null
	// Offers "watch now" on each release; absent without a debrid service.
	watching?: ReleaseWatching
}

// Search for a title's releases in a sheet, as Seanime does it: the missing
// episodes on top, the results below to tick, one button to download them. A
// batch only brings the episodes that are missing.
export function TorrentSearchDrawer({
	mediaRef,
	title,
	missing,
	poster,
	watching
}: TorrentSearchDrawerProps) {
	const { t } = useTranslation()

	const [open, close, target] = useUnit([$searchOpen, searchClosed, $searchTarget])
	// Picking a release to watch is not picking what to download: there is nothing
	// missing to call out, and the sheet says so by its own name.
	const watchOnly = target.intent === 'watch'

	return (
		<Drawer
			open={open}
			onOpenChange={next => !next && close()}
			title={t(watchOnly ? 'torrents.search.watchDrawerTitle' : 'torrents.search.drawerTitle')}
			description={
				<span className={styles.descriptionRow}>
					{title}
					{!watchOnly && missing && (
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
					watching={watching}
					onDone={close}
				/>
			)}
		</Drawer>
	)
}
