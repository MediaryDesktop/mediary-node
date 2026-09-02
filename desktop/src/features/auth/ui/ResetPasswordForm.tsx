import { useUnit } from 'effector-react'
import type { FormEvent } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon, Input } from '@shared/ui'

import { resetPasswordForm } from '../model/reset-password'

import styles from './AuthForm.module.scss'

export function ResetPasswordForm() {
	const { t } = useTranslation()
	const [email, failure, pending] = useUnit([
		resetPasswordForm.email.$value,
		resetPasswordForm.$failure,
		resetPasswordForm.$pending
	])

	const submit = (event: FormEvent) => {
		event.preventDefault()
		resetPasswordForm.submitted()
	}

	return (
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
				onChange={event => resetPasswordForm.email.changed(event.target.value)}
			/>

			<Button
				type='submit'
				variant='primary'
				fullWidth
				loading={pending}
				endIcon={<Icon name='common/arrow-right' size={18} />}
				className={styles.submit}
			>
				{t('auth.reset.submit')}
			</Button>
		</form>
	)
}
