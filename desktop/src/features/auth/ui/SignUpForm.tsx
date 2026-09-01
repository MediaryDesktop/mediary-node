import { useUnit } from 'effector-react'
import type { FormEvent } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon, Input } from '@shared/ui'

import { MIN_PASSWORD_LENGTH } from '../lib/validation'
import { signUpForm } from '../model/sign-up'

import styles from './AuthForm.module.scss'

export interface SignUpFormProps {
	onSwitchToSignIn: () => void
}

export function SignUpForm({ onSwitchToSignIn }: SignUpFormProps) {
	const { t } = useTranslation()
	const [name, email, password, confirmation, failure, pending] = useUnit([
		signUpForm.name.$value,
		signUpForm.email.$value,
		signUpForm.password.$value,
		signUpForm.confirmation.$value,
		signUpForm.$failure,
		signUpForm.$pending
	])

	const submit = (event: FormEvent) => {
		event.preventDefault()
		signUpForm.submitted()
	}

	return (
		<>
			<header className={styles.header}>
				<span className={styles.badge}>
					<Icon name='common/user' size={24} />
				</span>
				<h2 className={styles.title}>{t('auth.signUp.title')}</h2>
				<p className={styles.subtitle}>{t('auth.signUp.subtitle')}</p>
			</header>

			<form className={styles.form} onSubmit={submit} noValidate>
				{failure?.message && <p className={styles.formError}>{failure.message}</p>}

				<Input
					name='display_name'
					placeholder={t('auth.field.name')}
					autoComplete='nickname'
					startIcon={<Icon name='common/user' size={18} />}
					value={name}
					error={failure?.fields.display_name}
					onChange={event => signUpForm.name.changed(event.target.value)}
				/>

				<Input
					type='email'
					name='email'
					placeholder={t('auth.field.email')}
					autoComplete='email'
					startIcon={<Icon name='common/mail' size={18} />}
					value={email}
					error={failure?.fields.email}
					onChange={event => signUpForm.email.changed(event.target.value)}
				/>

				<Input
					type='password'
					name='password'
					placeholder={t('auth.field.passwordHint', { min: MIN_PASSWORD_LENGTH })}
					autoComplete='new-password'
					revealable
					startIcon={<Icon name='common/lock' size={18} />}
					value={password}
					error={failure?.fields.password}
					onChange={event => signUpForm.password.changed(event.target.value)}
				/>

				<Input
					type='password'
					name='confirmation'
					placeholder={t('auth.field.confirmation')}
					autoComplete='new-password'
					revealable
					startIcon={<Icon name='common/lock' size={18} />}
					value={confirmation}
					error={failure?.fields.confirmation}
					onChange={event => signUpForm.confirmation.changed(event.target.value)}
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

			<p className={styles.footer}>
				{t('auth.signUp.haveAccount')}{' '}
				<button type='button' className={styles.switch} onClick={onSwitchToSignIn}>
					{t('auth.signUp.switch')}
				</button>
			</p>
		</>
	)
}
