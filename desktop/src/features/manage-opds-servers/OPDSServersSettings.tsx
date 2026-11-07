import { useUnit } from 'effector-react'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Button, CollapsibleSection, EmptyCard, Icon, toast } from '@shared/ui'

import { useNodeData } from '@infra/node'

import { OPDS_KINDS } from './config/kinds'
import type { OPDSKind } from './config/kinds'
import { serverEditors } from './model/editor'
import styles from './OPDSServersSettings.module.scss'
import { ServerForm } from './ui/server-form/ServerForm'
import { ServerRow } from './ui/server-row/ServerRow'

export interface OPDSServersSettingsProps {
	kind: OPDSKind
}

export function OPDSServersSettings({ kind }: OPDSServersSettingsProps) {
	const { t } = useTranslation()
	const { servers: query, remove: removal, section, text, toast: toastId } = OPDS_KINDS[kind]
	const editor = serverEditors[kind]

	const [data, remove, removing] = useUnit([query.$data, removal.start, removal.$pending])
	const [editing, opened, closed] = useUnit([editor.$editing, editor.opened, editor.closed])

	const adding = editing !== null && editing.server === null

	useNodeData(query)

	useUnitWatch(removal.finished.failure, () =>
		toast.error(t(`${text}.removeFailed`), { id: `${toastId}-remove-failed` })
	)
	useUnitWatch(editor.saveFailed, error =>
		toast.error(problemDetail(error, t(`${text}.saveFailed`)), { id: `${toastId}-save-failed` })
	)

	const servers = data?.servers ?? []

	return (
		<div className={styles.card}>
			<div className={styles.header}>
				<div className={styles.headerText}>
					<h3 className={styles.title}>{t(`${section}.name`)}</h3>
					<p className={styles.hint}>{t(`${section}.hint`)}</p>
				</div>

				<Button
					size='small'
					iconOnly
					aria-label={adding ? t('common.cancel') : t(`${text}.add`)}
					startIcon={<Icon name={adding ? 'common/close' : 'common/plus'} size={16} />}
					onClick={() => (adding ? closed() : opened(null))}
				/>
			</div>

			{servers.length > 0 ? (
				<div className={styles.list}>
					{servers.map(server => (
						<ServerRow
							key={server.id}
							kind={kind}
							server={server}
							removing={removing}
							onRemove={() => remove(server.id)}
						/>
					))}
				</div>
			) : (
				<EmptyCard
					icon='common/database'
					title={t(`${text}.none`)}
					description={t(`${text}.noneHint`)}
				/>
			)}

			<CollapsibleSection open={adding}>
				<div className={styles.addSection}>
					<ServerForm kind={kind} />
				</div>
			</CollapsibleSection>
		</div>
	)
}
