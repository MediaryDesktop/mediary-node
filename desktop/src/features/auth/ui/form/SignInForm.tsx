import { useUnit } from 'effector-react'
import type { FormEvent } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon, Input } from '@shared/ui'

import { signInForm } from '../../model'
import { AuthLink } from '../common'

import styles from './AuthForm.module.scss'

export interface SignInFormProps {
	onForgotPassword: () => void
}

export function SignInForm({ onForgotPassword }: SignInFormProps) {
	const { t } = useTranslation()
	const [email, password, pending] = useUnit([
		signInForm.fields.email.$value,
		signInForm.fields.password.$value,
		signInForm.$pending
	])

	const submit = (event: FormEvent) => {
		event.preventDefault()
		signInForm.submitted()
	}

	return (
		<form className={styles.form} onSubmit={submit} noValidate>
			<Input
				type='email'
				name='email'
				placeholder={t('auth.field.email')}
				autoComplete='email'
				startIcon={<Icon name='common/mail' size={18} />}
				value={email}
				onChange={event => signInForm.fields.email.changed(event.target.value)}
			/>

			<Input
				type='password'
				name='password'
				placeholder={t('auth.field.password')}
				autoComplete='current-password'
				revealable
				startIcon={<Icon name='common/lock' size={18} />}
				value={password}
				onChange={event => signInForm.fields.password.changed(event.target.value)}
			/>

			<div className={styles.options}>
				<AuthLink onClick={onForgotPassword}>{t('auth.signIn.forgotPassword')}</AuthLink>
			</div>

			<Button
				type='submit'
				variant='primary'
				fullWidth
				loading={pending}
				endIcon={<Icon name='common/arrow-right' size={18} />}
				className={styles.submit}
			>
				{t('auth.signIn.submit')}
			</Button>
		</form>
	)
}
