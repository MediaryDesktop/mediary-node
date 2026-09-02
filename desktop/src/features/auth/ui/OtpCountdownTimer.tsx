import clsx from 'clsx'

import { useTranslation } from '@shared/i18n'

import styles from './OtpCountdownTimer.module.scss'

export interface OtpCountdownTimerProps {
	expired: boolean
	formatted: string
	className?: string
}

export function OtpCountdownTimer({ expired, formatted, className }: OtpCountdownTimerProps) {
	const { t } = useTranslation()

	return (
		<span className={clsx(styles.timer, expired && styles.expired, className)}>
			{expired ? t('auth.otp.expired') : t('auth.otp.remaining', { time: formatted })}
		</span>
	)
}
