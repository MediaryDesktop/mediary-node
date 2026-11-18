import { useUnit } from 'effector-react'
import { MdFormatListBulletedAdd } from 'react-icons/md'

import { useTranslation } from '@shared/i18n'
import { Button, Icon } from '@shared/ui'

import { trackerModel } from '@entities/tracker'

import { manageEntryModel } from '../../model/manage-entry'
import { rateEntryModel } from '../../model/rate-entry'
import { EntryMenu } from '../entry-menu/EntryMenu'
import type { EntryMenuProps } from '../entry-menu/EntryMenu'

import styles from './EntryActions.module.scss'

export function EntryActions({ media, entry, listName }: EntryMenuProps) {
	const { t } = useTranslation()

	const [updating, manageOpened, addOpened, rateOpened] = useUnit([
		trackerModel.$updating,
		manageEntryModel.opened,
		manageEntryModel.addOpened,
		rateEntryModel.opened
	])

	const busy = Boolean(updating[media.mediaRef])
	const target = entry ? { entry, mediaType: media.mediaType } : null

	return (
		<>
			<div className={styles.actions}>
				{target ? (
					<>
						<Button
							size='small'
							variant='secondary'
							iconOnly
							className={styles.round}
							disabled={busy}
							aria-label={t('lists.manageEntry.action')}
							title={t('lists.manageEntry.action')}
							onClick={() => manageOpened(target)}
						>
							<Icon name='common/folder' size={16} />
						</Button>

						<Button
							size='small'
							variant='secondary'
							iconOnly
							className={styles.round}
							disabled={busy}
							aria-label={t('lists.rateEntry.action')}
							title={t('lists.rateEntry.action')}
							onClick={() => rateOpened(target)}
						>
							<Icon name='common/pencil' size={16} />
						</Button>
					</>
				) : (
					<Button
						size='small'
						variant='secondary'
						iconOnly
						className={styles.round}
						disabled={busy}
						aria-label={t('media.addToList')}
						title={t('media.addToList')}
						onClick={() =>
							addOpened({
								mediaRef: media.mediaRef,
								mediaType: media.mediaType,
								title: media.title
							})
						}
					>
						<MdFormatListBulletedAdd size={20} />
					</Button>
				)}
			</div>

			<EntryMenu media={media} entry={entry} listName={listName} triggerClassName={styles.corner} />
		</>
	)
}
