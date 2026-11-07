import clsx from 'clsx'
import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'
import { CollapsibleSection, Icon, MoreMenu } from '@shared/ui'

import { OPDS_KINDS } from '../../config/kinds'
import type { OPDSKind } from '../../config/kinds'
import type { EditedServer } from '../../lib/form'
import { serverEditors } from '../../model/editor'
import { ServerForm } from '../server-form/ServerForm'

import styles from './ServerRow.module.scss'

export interface ServerRowProps {
	kind: OPDSKind
	server: EditedServer
	removing: boolean
	onRemove: () => void
}

export function ServerRow({ kind, server, removing, onRemove }: ServerRowProps) {
	const { t } = useTranslation()
	const { text } = OPDS_KINDS[kind]
	const editor = serverEditors[kind]

	const [editing, opened, closed] = useUnit([editor.$editing, editor.opened, editor.closed])

	const open = editing?.item?.id === server.id

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
					label={t(`${text}.menu`)}
					items={[
						{
							id: 'edit',
							label: open ? t('common.cancel') : t(`${text}.edit`),
							icon: open ? 'common/close' : 'common/pencil',
							onSelect: () => (open ? closed() : opened(server))
						},
						{
							id: 'remove',
							label: t(`${text}.remove`),
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
					<ServerForm kind={kind} />
				</div>
			</CollapsibleSection>
		</div>
	)
}
