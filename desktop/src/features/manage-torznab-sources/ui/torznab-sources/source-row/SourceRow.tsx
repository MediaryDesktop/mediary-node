import clsx from 'clsx'
import { useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { CollapsibleSection, Icon, MoreMenu } from '@shared/ui'

import type { TorrentSource } from '@entities/torrent'

import { TorznabSourceForm } from '../source-form/TorznabSourceForm'

import styles from './SourceRow.module.scss'

export interface SourceRowProps {
	source: TorrentSource
	removing: boolean
	onRemove: () => void
}

// One configured Torznab source: its name and address, a menu to edit or
// remove it, and — while editing — the same form "Add a source" uses below,
// unfolding right under this row instead of in a drawer. The form stays
// mounted through the closing animation (CollapsibleSection only hides it);
// formKey remounts it with fresh fields each time editing opens again, so a
// cancelled edit never lingers into the next one.
export function SourceRow({ source, removing, onRemove }: SourceRowProps) {
	const { t } = useTranslation()

	const [open, setOpen] = useState(false)
	const [formKey, setFormKey] = useState(0)

	const toggle = () =>
		setOpen(current => {
			if (!current) {
				setFormKey(key => key + 1)
			}
			return !current
		})

	return (
		<div className={clsx(styles.row, open && styles.open)}>
			<div className={styles.head}>
				<span className={styles.badge}>
					<Icon name='common/search' size={20} />
				</span>

				<span className={styles.body}>
					<span className={styles.name}>{source.name}</span>
					<span className={styles.url} title={source.url}>
						{source.url}
					</span>
				</span>

				<MoreMenu
					label={t('torrents.sources.menu')}
					items={[
						{
							id: 'edit',
							label: open ? t('common.cancel') : t('torrents.sources.edit'),
							icon: open ? 'common/close' : 'common/pencil',
							onSelect: toggle
						},
						{
							id: 'remove',
							label: t('torrents.sources.remove'),
							icon: 'common/trash',
							danger: true,
							disabled: removing,
							onSelect: onRemove
						}
					]}
				/>
			</div>

			<CollapsibleSection open={open}>
				<div className={styles.form}>
					<TorznabSourceForm key={formKey} source={source} onDone={() => setOpen(false)} />
				</div>
			</CollapsibleSection>
		</div>
	)
}
