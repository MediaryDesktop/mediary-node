import { Button } from '../button/Button'
import { Icon } from '../icon/Icon'

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
}

// A "test the connection" button with the answer beside it.
export function ConnectionCheck({ label, checking, disabled, status, onCheck }: ConnectionCheckProps) {
	return (
		<div className={styles.check}>
			<Button
				size='small'
				startIcon={<Icon name='common/signal' size={16} />}
				loading={checking}
				disabled={disabled}
				onClick={onCheck}
			>
				{label}
			</Button>

			{status && (
				<span className={status.ok ? styles.ok : styles.problem} role='status'>
					{status.message}
				</span>
			)}
		</div>
	)
}
