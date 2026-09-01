import { useUnit } from 'effector-react'
import type { FormEvent } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon, Input } from '@shared/ui'

import { signInForm } from '../model/sign-in'

import styles from './AuthForm.module.scss'

export interface SignInFormProps {
	onSwitchToSignUp: () => void
}

export function SignInForm({ onSwitchToSignUp }: SignInFormProps) {
	const { t } = useTranslation()
	const [email, password, failure, pending] = useUnit([
		signInForm.email.$value,
		signInForm.password.$value,
		signInForm.$failure,
		signInForm.$pending
	])

	const submit = (event: FormEvent) => {
		event.preventDefault()
		signInForm.submitted()
	}

	return (
		<>
			<header className={styles.header}>
				<span className={styles.badge}>
					<Icon name='common/user' size={24} />
				</span>
				<h2 className={styles.title}>{t('auth.signIn.title')}</h2>
				<p className={styles.subtitle}>{t('auth.signIn.subtitle')}</p>
			</header>

			<form className={styles.form} onSubmit={submit} noValidate>
				{failure?.message && <p className={styles.formError}>{failure.message}</p>}

				<Input
					type='email'
					name='email'
					placeholder={t('auth.field.email')}
					autoComplete='email'
					startIcon={<Icon name='common/mail' size={18} />}
					value={email}
					error={failure?.fields.email}
					onChange={event => signInForm.email.changed(event.target.value)}
				/>

				<Input
					type='password'
					name='password'
					placeholder={t('auth.field.password')}
					autoComplete='current-password'
					revealable
					startIcon={<Icon name='common/lock' size={18} />}
					value={password}
					error={failure?.fields.password}
					onChange={event => signInForm.password.changed(event.target.value)}
				/>

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

			<p className={styles.footer}>
				{t('auth.signIn.noAccount')}{' '}
				<button type='button' className={styles.switch} onClick={onSwitchToSignUp}>
					{t('auth.signIn.switch')}
				</button>
			</p>
		</>
	)
}
