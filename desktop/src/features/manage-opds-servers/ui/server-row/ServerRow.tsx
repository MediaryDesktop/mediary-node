import clsx from 'clsx'
import { useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { CollapsibleSection, Icon, MoreMenu } from '@shared/ui'

import type { OPDSServer } from '@entities/manga-source'

import { OPDSServerForm } from '../server-form/OPDSServerForm'

import styles from './ServerRow.module.scss'

export interface ServerRowProps {
	server: OPDSServer
	removing: boolean
	onRemove: () => void
}

export function ServerRow({ server, removing, onRemove }: ServerRowProps) {
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
					<Icon name='common/database' size={20} />
				</span>

				<span className={styles.body}>
					<span className={styles.name}>{server.name}</span>
					<span className={styles.url} title={server.url}>
						{server.username ? `${server.username} · ${server.url}` : server.url}
					</span>
				</span>

				<MoreMenu
					label={t('mangaSources.menu')}
					items={[
						{
							id: 'edit',
							label: open ? t('common.cancel') : t('mangaSources.edit'),
							icon: open ? 'common/close' : 'common/pencil',
							onSelect: toggle
						},
						{
							id: 'remove',
							label: t('mangaSources.remove'),
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
					<OPDSServerForm key={formKey} server={server} onDone={() => setOpen(false)} />
				</div>
			</CollapsibleSection>
		</div>
	)
}
