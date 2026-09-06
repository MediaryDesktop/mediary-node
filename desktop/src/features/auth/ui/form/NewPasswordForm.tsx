import { useUnit } from 'effector-react'
import type { FormEvent } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon, Input, OtpInput } from '@shared/ui'

import { useOtpCountdown } from '../../hooks'
import { newPasswordForm } from '../../model'
import { CODE_LENGTH, MIN_PASSWORD_LENGTH } from '../../validation'
import { OtpCountdownTimer } from '../common'

import styles from './AuthForm.module.scss'

export interface NewPasswordFormProps {
	email: string
}

export function NewPasswordForm({ email }: NewPasswordFormProps) {
	const { t } = useTranslation()
	const [code, password, pending, expiresAt] = useUnit([
		newPasswordForm.fields.code.$value,
		newPasswordForm.fields.password.$value,
		newPasswordForm.$pending,
		newPasswordForm.$expiresAt
	])
	const { known, expired, formatted } = useOtpCountdown(expiresAt)

	const submit = (event: FormEvent) => {
		event.preventDefault()
		newPasswordForm.submitted(email)
	}

	return (
		<form className={styles.form} onSubmit={submit} noValidate>
			<OtpInput
				className={styles.otp}
				value={code}
				length={CODE_LENGTH}
				disabled={pending}
				aria-label={t('auth.field.code')}
				onChange={newPasswordForm.fields.code.changed}
			/>

			<Input
				type='password'
				name='password'
				placeholder={t('auth.field.passwordHint', { min: MIN_PASSWORD_LENGTH })}
				autoComplete='new-password'
				revealable
				startIcon={<Icon name='common/lock' size={18} />}
				value={password}
				onChange={event => newPasswordForm.fields.password.changed(event.target.value)}
			/>

			<Button
				type='submit'
				variant='primary'
				fullWidth
				loading={pending}
				endIcon={<Icon name='common/arrow-right' size={18} />}
				className={styles.submit}
			>
				{t('auth.newPassword.submit')}
			</Button>

			<p className={styles.resend}>
				{known && <OtpCountdownTimer expired={expired} formatted={formatted} />}
			</p>
		</form>
	)
}
