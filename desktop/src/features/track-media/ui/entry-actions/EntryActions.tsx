import { useUnit } from 'effector-react'

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
		<div className={styles.actions}>
			{target ? (
				<Button
					size='small'
					variant='control'
					disabled={busy}
					startIcon={<Icon name='common/list-checks' size={16} />}
					endIcon={<Icon name='common/chevron-down' size={16} />}
					onClick={() => manageOpened(target)}
				>
					{t(`lists.status.${media.mediaType}.${target.entry.status}` as never)}
				</Button>
			) : (
				<Button
					size='small'
					variant='control'
					disabled={busy}
					startIcon={<Icon name='common/plus' size={16} />}
					onClick={() =>
						addOpened({
							mediaRef: media.mediaRef,
							mediaType: media.mediaType,
							title: media.title
						})
					}
				>
					{t('media.addToList')}
				</Button>
			)}

			{target && (
				<Button
					size='small'
					variant='control'
					iconOnly
					disabled={busy}
					aria-label={t('lists.rateEntry.action')}
					title={t('lists.rateEntry.action')}
					onClick={() => rateOpened(target)}
				>
					<Icon name='common/star' size={16} />
				</Button>
			)}

			<EntryMenu media={media} entry={entry} listName={listName} />
		</div>
	)
}
