import type { ReactNode } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon } from '@shared/ui'

import styles from './SaveBar.module.scss'

export interface SaveBarProps {
	status: string
	onCancel: () => void
	onSave: () => void
	saving: boolean
	saveDisabled?: boolean
	saveLabel: string
	deleteAction?: ReactNode
}

export function SaveBar({
	status,
	onCancel,
	onSave,
	saving,
	saveDisabled,
	saveLabel,
	deleteAction
}: SaveBarProps) {
	const { t } = useTranslation()

	return (
		<div className={styles.bar}>
			<div className={styles.start}>
				<span className={styles.status}>
					<Icon name='common/check' size={14} />
					{status}
				</span>

				{deleteAction}
			</div>

			<div className={styles.end}>
				<Button variant='secondary' onClick={onCancel} disabled={saving}>
					{t('manualMedia.cancel')}
				</Button>

				<Button variant='primary' onClick={onSave} loading={saving} disabled={saveDisabled}>
					{saveLabel}
				</Button>
			</div>
		</div>
	)
}
