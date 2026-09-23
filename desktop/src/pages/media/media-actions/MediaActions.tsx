import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'
import { Button, DropdownMenu, Icon, Tooltip } from '@shared/ui'
import type { DropdownMenuItem } from '@shared/ui'

import type { MediaSource } from '@entities/media'
import { isTrackerMediaType } from '@entities/tracker'
import type { TrackerEntry } from '@entities/tracker'

import { manageEntryModel, rateEntryModel } from '@features/track-media'

import styles from './MediaActions.module.scss'

export interface MediaActionsProps {
	entry: TrackerEntry | null
	sources: MediaSource[]
	mediaType: string
	siteUrl: string
	total: number | null | undefined
	onOpenDetails: () => void
}

export function MediaActions({
	entry,
	sources,
	mediaType,
	siteUrl,
	total,
	onOpenDetails
}: MediaActionsProps) {
	const { t } = useTranslation()

	const [manageOpened, rateOpened] = useUnit([manageEntryModel.opened, rateEntryModel.opened])

	const trackerType = isTrackerMediaType(mediaType) ? mediaType : null
	const target = entry && trackerType ? { entry, mediaType: trackerType } : null

	const items: DropdownMenuItem[] = [
		{
			id: 'details',
			label: t('media.menu.details'),
			icon: 'common/info',
			onSelect: onOpenDetails
		},
		{
			id: 'anilist',
			label: t('media.openOn', { name: sources[0]?.name ?? 'AniList' }),
			icon: 'common/external-link',
			onSelect: () => window.open(siteUrl, '_blank', 'noreferrer')
		},
		{
			id: 'library',
			label: t('media.menu.addToLibrary'),
			icon: 'common/library',
			disabled: true,
			onSelect: () => {}
		}
	]

	if (target) {
		items.unshift({
			id: 'manage',
			label: t('lists.manageEntry.action'),
			icon: 'common/folder',
			onSelect: () => manageOpened(target)
		})
	}

	return (
		<div className={styles.actions}>
			<div className={styles.actionButtons}>
				{target ? (
					<Tooltip content={t('lists.rateEntry.action')}>
						<Button
							iconOnly
							variant='ghost'
							className={styles.iconAction}
							aria-label={t('lists.rateEntry.action')}
							onClick={() => rateOpened(target)}
						>
							<Icon name='common/pencil' size={16} />
						</Button>
					</Tooltip>
				) : (
					<Tooltip content={t('media.comingSoon')}>
						<span className={styles.iconActionWrap}>
							<Button
								iconOnly
								variant='ghost'
								disabled
								className={styles.iconAction}
								aria-label={t('media.addToList')}
							>
								<Icon name='common/plus' size={16} />
							</Button>
						</span>
					</Tooltip>
				)}

				<DropdownMenu
					trigger={
						<Button
							iconOnly
							variant='ghost'
							className={styles.iconAction}
							aria-label={t('media.menu.label')}
						>
							<Icon name='common/more-vertical' size={18} />
						</Button>
					}
					items={items}
				/>

				<Tooltip content={t('media.comingSoon')}>
					<span className={styles.iconActionWrap}>
						<Button disabled startIcon={<Icon name='common/download' size={20} />}>
							{t('media.downloadBatch', { count: total ?? 0 })}
						</Button>
					</span>
				</Tooltip>
			</div>

			<div className={styles.viewTabs} role='tablist'>
				<Button
					role='tab'
					aria-selected
					variant='ghost'
					className={styles.viewTab}
					startIcon={<Icon name='common/library' size={20} />}
				>
					{t('media.views.library')}
				</Button>

				<Tooltip content={t('media.comingSoon')}>
					<span className={styles.iconActionWrap}>
						<Button
							role='tab'
							aria-selected={false}
							disabled
							variant='ghost'
							className={styles.viewTab}
						>
							{t('media.views.torrent')}
						</Button>
					</span>
				</Tooltip>
			</div>
		</div>
	)
}
