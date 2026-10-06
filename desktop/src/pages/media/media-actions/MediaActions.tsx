import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'
import { Button, DropdownMenu, Icon, Tooltip } from '@shared/ui'
import type { DropdownMenuItem } from '@shared/ui'

import { aniListAccountModel } from '@entities/anilist-account'
import type { MediaSource } from '@entities/media'
import { isTrackerMediaType } from '@entities/tracker'
import type { TrackerEntry } from '@entities/tracker'

import { manageEntryModel, rateEntryModel } from '@features/track-media'

import styles from './MediaActions.module.scss'

export type MediaView = 'library' | 'torrent'

export interface MediaActionsProps {
	mediaRef: string
	title: string
	entry: TrackerEntry | null
	sources: MediaSource[]
	mediaType: string
	siteUrl: string
	total: number | null | undefined
	view: MediaView
	// Absent where torrents make no sense: manga is read, not downloaded as video.
	onViewChange?: (view: MediaView) => void
	onOpenDetails: () => void
}

export function MediaActions({
	mediaRef,
	title,
	entry,
	sources,
	mediaType,
	siteUrl,
	total,
	view,
	onViewChange,
	onOpenDetails
}: MediaActionsProps) {
	const { t } = useTranslation()

	const [connected, manageOpened, addOpened, rateOpened] = useUnit([
		aniListAccountModel.$connected,
		manageEntryModel.opened,
		manageEntryModel.addOpened,
		rateEntryModel.opened
	])

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
				) : connected && trackerType ? (
					<Tooltip content={t('media.addToList')}>
						<Button
							iconOnly
							variant='ghost'
							className={styles.iconAction}
							aria-label={t('media.addToList')}
							onClick={() => addOpened({ mediaRef, mediaType: trackerType, title })}
						>
							<Icon name='common/plus' size={16} />
						</Button>
					</Tooltip>
				) : null}

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
					aria-selected={view === 'library'}
					variant='ghost'
					className={styles.viewTab}
					startIcon={<Icon name='common/library' size={20} />}
					onClick={() => onViewChange?.('library')}
				>
					{t('media.views.library')}
				</Button>

				{onViewChange && (
					<Button
						role='tab'
						aria-selected={view === 'torrent'}
						variant='ghost'
						className={styles.viewTab}
						startIcon={<Icon name='common/download' size={20} />}
						onClick={() => onViewChange('torrent')}
					>
						{t('media.views.torrent')}
					</Button>
				)}
			</div>
		</div>
	)
}
