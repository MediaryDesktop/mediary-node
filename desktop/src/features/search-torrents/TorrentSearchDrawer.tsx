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
	title: string
	missing: number[] | null
	poster?: string | null
	watching?: ReleaseWatching
}

export function TorrentSearchDrawer({
	mediaRef,
	title,
	missing,
	poster,
	watching
}: TorrentSearchDrawerProps) {
	const { t } = useTranslation()

	const [open, close, target] = useUnit([$searchOpen, searchClosed, $searchTarget])
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
