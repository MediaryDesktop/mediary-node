import { useTranslation } from '../../i18n'
import { Button } from '../button/Button'
import { Icon } from '../icon/Icon'
import { Tooltip } from '../tooltip/Tooltip'

import styles from './ConnectionCheck.module.scss'

export interface ConnectionCheckStatus {
	ok: boolean
	message: string
}

export interface ConnectionCheckProps {
	label: string
	checking: boolean
	disabled?: boolean
	status: ConnectionCheckStatus | null
	onCheck: () => void
	size?: 'default' | 'small'
}

export function ConnectionCheck({
	label,
	checking,
	disabled,
	status,
	onCheck,
	size = 'small'
}: ConnectionCheckProps) {
	const { t } = useTranslation()

	const button = (
		<Button
			size={size}
			variant={status ? (status.ok ? 'glass-success' : 'glass-danger') : undefined}
			startIcon={
				<Icon
					name={status ? (status.ok ? 'common/check' : 'common/close') : 'common/signal'}
					size={16}
				/>
			}
			loading={checking}
			disabled={disabled}
			onClick={onCheck}
		>
			{status ? (status.ok ? t('common.connected') : t('common.connectionFailed')) : label}
		</Button>
	)

	if (!status) {
		return button
	}

	return (
		<span className={styles.check} role='status'>
			<Tooltip content={status.message}>{button}</Tooltip>
		</span>
	)
}
