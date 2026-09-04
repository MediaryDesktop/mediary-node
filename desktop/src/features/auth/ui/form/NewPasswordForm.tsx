import { useUnit } from 'effector-react'
import type { FormEvent } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon, Input, OtpInput } from '@shared/ui'

import { useOtpCountdown } from '../../hooks'
import { newPasswordForm } from '../../model'
import { CODE_LENGTH, CODE_TTL_SECONDS, MIN_PASSWORD_LENGTH } from '../../validation'
import { OtpCountdownTimer } from '../common'

import styles from './AuthForm.module.scss'

export interface NewPasswordFormProps {
	email: string
}

export function NewPasswordForm({ email }: NewPasswordFormProps) {
	const { t } = useTranslation()
	const { expired, formatted } = useOtpCountdown(CODE_TTL_SECONDS)
	const [code, password, pending] = useUnit([
		newPasswordForm.code.$value,
		newPasswordForm.password.$value,
		newPasswordForm.$pending
	])

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
				disabled={expired || pending}
				aria-label={t('auth.field.code')}
				onChange={newPasswordForm.code.changed}
			/>

			<Input
				type='password'
				name='password'
				placeholder={t('auth.field.passwordHint', { min: MIN_PASSWORD_LENGTH })}
				autoComplete='new-password'
				revealable
				startIcon={<Icon name='common/lock' size={18} />}
				value={password}
				onChange={event => newPasswordForm.password.changed(event.target.value)}
			/>

			<Button
				type='submit'
				variant='primary'
				fullWidth
				loading={pending}
				disabled={expired}
				endIcon={<Icon name='common/arrow-right' size={18} />}
				className={styles.submit}
			>
				{t('auth.newPassword.submit')}
			</Button>

			<p className={styles.resend}>
				<OtpCountdownTimer expired={expired} formatted={formatted} />
			</p>
		</form>
	)
}
