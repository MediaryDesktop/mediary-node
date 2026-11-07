import clsx from 'clsx'
import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'
import { CollapsibleSection, Icon, MoreMenu } from '@shared/ui'

import type { TorrentSource } from '@entities/torrent'

import { sourceEditor } from '../../../model/editor'
import { TorznabSourceForm } from '../source-form/TorznabSourceForm'

import styles from './SourceRow.module.scss'

export interface SourceRowProps {
	source: TorrentSource
	removing: boolean
	onRemove: () => void
}

export function SourceRow({ source, removing, onRemove }: SourceRowProps) {
	const { t } = useTranslation()

	const [editing, opened, closed] = useUnit([
		sourceEditor.$editing,
		sourceEditor.opened,
		sourceEditor.closed
	])

	const open = editing?.item?.id === source.id
	const toggle = () => (open ? closed() : opened(source))

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
					<TorznabSourceForm />
				</div>
			</CollapsibleSection>
		</div>
	)
}
