import { useUnit } from 'effector-react'
import type { FormEvent } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon, Input } from '@shared/ui'

import { signUpForm } from '../../model'
import { MIN_PASSWORD_LENGTH } from '../../validation'

import styles from './AuthForm.module.scss'

export function SignUpForm() {
	const { t } = useTranslation()
	const [name, email, password, confirmation, pending] = useUnit([
		signUpForm.fields.display_name.$value,
		signUpForm.fields.email.$value,
		signUpForm.fields.password.$value,
		signUpForm.fields.confirmation.$value,
		signUpForm.$pending
	])

	const submit = (event: FormEvent) => {
		event.preventDefault()
		signUpForm.submitted()
	}

	return (
		<form className={styles.form} onSubmit={submit} noValidate>
			<Input
				name='display_name'
				placeholder={t('auth.field.name')}
				autoComplete='nickname'
				startIcon={<Icon name='common/user' size={18} />}
				value={name}
				onChange={event => signUpForm.fields.display_name.changed(event.target.value)}
			/>

			<Input
				type='email'
				name='email'
				placeholder={t('auth.field.email')}
				autoComplete='email'
				startIcon={<Icon name='common/mail' size={18} />}
				value={email}
				onChange={event => signUpForm.fields.email.changed(event.target.value)}
			/>

			<Input
				type='password'
				name='password'
				placeholder={t('auth.field.passwordHint', { min: MIN_PASSWORD_LENGTH })}
				autoComplete='new-password'
				revealable
				startIcon={<Icon name='common/lock' size={18} />}
				value={password}
				onChange={event => signUpForm.fields.password.changed(event.target.value)}
			/>

			<Input
				type='password'
				name='confirmation'
				placeholder={t('auth.field.confirmation')}
				autoComplete='new-password'
				revealable
				startIcon={<Icon name='common/lock' size={18} />}
				value={confirmation}
				onChange={event => signUpForm.fields.confirmation.changed(event.target.value)}
			/>

			<Button
				type='submit'
				variant='primary'
				fullWidth
				loading={pending}
				endIcon={<Icon name='common/arrow-right' size={18} />}
				className={styles.submit}
			>
				{t('auth.signUp.submit')}
			</Button>
		</form>
	)
}
