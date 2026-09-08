import { useUnit } from 'effector-react'
import { useEffect } from 'react'
import type { FormEvent } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, OtpInput } from '@shared/ui'

import { useOtpCountdown } from '../../hooks'
import { verifyEmailForm } from '../../model'
import { CODE_LENGTH } from '../../validation'
import { AuthLink, OtpCountdownTimer } from '../common'

import styles from './AuthForm.module.scss'

export function VerifyEmailForm() {
	const { t } = useTranslation()
	const [code, pending, resendPending, expiresAt] = useUnit([
		verifyEmailForm.fields.code.$value,
		verifyEmailForm.$pending,
		verifyEmailForm.$resendPending,
		verifyEmailForm.$expiresAt
	])
	const { known, expired, formatted } = useOtpCountdown(expiresAt)

	useEffect(() => verifyEmailForm.mounted(), [])

	const submit = (event: FormEvent) => {
		event.preventDefault()
		verifyEmailForm.submitted()
	}

	const resend = () => verifyEmailForm.resent()

	return (
		<form className={styles.form} onSubmit={submit} noValidate>
			<OtpInput
				className={styles.otp}
				value={code}
				length={CODE_LENGTH}
				disabled={pending}
				aria-label={t('auth.field.code')}
				onChange={verifyEmailForm.fields.code.changed}
			/>

			<Button
				type='submit'
				variant='primary'
				fullWidth
				loading={pending}
				className={styles.submit}
			>
				{t('auth.verify.submit')}
			</Button>

			<p className={styles.resend}>
				{t('auth.verify.resendLabel')}
				<AuthLink onClick={resend} disabled={resendPending}>
					{t('auth.verify.resend')}
				</AuthLink>
				{known && <OtpCountdownTimer expired={expired} formatted={formatted} />}
			</p>
		</form>
	)
}
