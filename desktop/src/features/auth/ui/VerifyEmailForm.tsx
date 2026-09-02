import { useUnit } from 'effector-react'
import type { FormEvent } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon, OtpInput } from '@shared/ui'

import { useOtpCountdown } from '../hooks/useOtpCountdown'
import { CODE_LENGTH, CODE_TTL_SECONDS } from '../lib/validation'
import { verifyEmailForm } from '../model/verify-email'

import styles from './AuthForm.module.scss'
import { AuthLink } from './AuthLink'
import { OtpCountdownTimer } from './OtpCountdownTimer'

export function VerifyEmailForm() {
	const { t } = useTranslation()
	const { expired, formatted, restart } = useOtpCountdown(CODE_TTL_SECONDS)
	const [code, failure, pending, resendPending] = useUnit([
		verifyEmailForm.code.$value,
		verifyEmailForm.$failure,
		verifyEmailForm.$pending,
		verifyEmailForm.$resendPending
	])

	const submit = (event: FormEvent) => {
		event.preventDefault()
		verifyEmailForm.submitted()
	}

	const resend = () => {
		verifyEmailForm.resent()
		restart()
	}

	return (
		<form className={styles.form} onSubmit={submit} noValidate>
			{failure?.message && <p className={styles.formError}>{failure.message}</p>}

			<OtpInput
				className={styles.otp}
				value={code}
				length={CODE_LENGTH}
				disabled={expired || pending}
				invalid={Boolean(failure?.fields.code)}
				aria-label={t('auth.field.code')}
				onChange={verifyEmailForm.code.changed}
			/>

			{failure?.fields.code && <p className={styles.fieldError}>{failure.fields.code}</p>}

			<Button
				type='submit'
				variant='primary'
				fullWidth
				loading={pending}
				disabled={expired}
				endIcon={<Icon name='common/arrow-right' size={18} />}
				className={styles.submit}
			>
				{t('auth.verify.submit')}
			</Button>

			<p className={styles.resend}>
				{t('auth.verify.resendLabel')}
				<AuthLink onClick={resend} disabled={resendPending}>
					{t('auth.verify.resend')}
				</AuthLink>
				<OtpCountdownTimer expired={expired} formatted={formatted} />
			</p>
		</form>
	)
}
