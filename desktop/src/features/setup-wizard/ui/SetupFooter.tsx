import { useTranslation } from '@shared/i18n'
import { Button, Icon } from '@shared/ui'

import styles from './SetupFooter.module.scss'

export interface SetupFooterProps {
	onBack?: () => void
	onNext?: () => void
	backDisabled?: boolean
	nextLabel?: string
}

export function SetupFooter({ onBack, onNext, backDisabled = false, nextLabel }: SetupFooterProps) {
	const { t } = useTranslation()

	return (
		<div className={styles.footer}>
			<Button
				variant='ghost'
				disabled={backDisabled}
				onClick={onBack}
				startIcon={<Icon name='common/arrow-left' size={16} />}
			>
				{t('setup.previous')}
			</Button>

			<Button variant='primary' onClick={onNext} endIcon={<Icon name='common/arrow-right' size={16} />}>
				{nextLabel ?? t('setup.next')}
			</Button>
		</div>
	)
}
