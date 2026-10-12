import { useTranslation } from '@shared/i18n'
import { DropdownMenu, Icon, RippleButton, SegmentedControl } from '@shared/ui'

import type { MangaLink } from '@entities/manga-source'

import styles from './ChapterToolbar.module.scss'

export interface ChapterToolbarProps {
	// Every source the list holds, by id; the filter shows when there are several.
	sources: Map<string, string>
	allValue: string
	active: string
	onFilter: (value: string) => void
	links: MangaLink[]
	onRelink: (source: string) => void
	onUnlink: (source: string) => void
}

// Which source the list shows, and the series each server is linked to.
export function ChapterToolbar({
	sources,
	allValue,
	active,
	onFilter,
	links,
	onRelink,
	onUnlink
}: ChapterToolbarProps) {
	const { t } = useTranslation()

	if (links.length === 0 && sources.size <= 1) {
		return null
	}

	return (
		<div className={styles.toolbar}>
			{sources.size > 1 && (
				<SegmentedControl
					label={t('mangaSources.chapters.filter')}
					value={active}
					onValueChange={onFilter}
					items={[
						{ value: allValue, label: t('mangaSources.chapters.all') },
						...[...sources].map(([value, label]) => ({ value, label }))
					]}
				/>
			)}

			{links.map(link => (
				<span key={link.source} className={styles.link}>
					<Icon name='common/database' size={16} />
					<span className={styles.linkText}>
						{link.series_title || link.series_id}{' '}
						<span className={styles.linkSource}>
							{t('mangaSources.chapters.from', { name: link.source_name })}
						</span>
					</span>

					<DropdownMenu
						items={[
							{
								id: 'relink',
								label: t('mangaSources.chapters.relink'),
								icon: 'common/search',
								onSelect: () => onRelink(link.source)
							},
							{
								id: 'unlink',
								label: t('mangaSources.chapters.unlink'),
								icon: 'common/trash',
								danger: true,
								onSelect: () => onUnlink(link.source)
							}
						]}
						trigger={
							<RippleButton className={styles.linkMenu} aria-label={t('mangaSources.menu')}>
								<Icon name='common/more-vertical' size={16} />
							</RippleButton>
						}
					/>
				</span>
			))}
		</div>
	)
}
