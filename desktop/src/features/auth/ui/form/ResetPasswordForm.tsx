import { useUnit } from 'effector-react'
import type { FormEvent } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon, Input } from '@shared/ui'

import { resetPasswordForm } from '../../model'

import styles from './AuthForm.module.scss'

export function ResetPasswordForm() {
	const { t } = useTranslation()
	const [email, pending] = useUnit([resetPasswordForm.fields.email.$value, resetPasswordForm.$pending])

	const submit = (event: FormEvent) => {
		event.preventDefault()
		resetPasswordForm.submitted()
	}

	return (
		<form className={styles.form} onSubmit={submit} noValidate>
			<Input
				variant='glass'
				type='email'
				name='email'
				placeholder={t('auth.field.email')}
				autoComplete='email'
				startIcon={<Icon name='common/mail' size={18} />}
				value={email}
				onChange={event => resetPasswordForm.fields.email.changed(event.target.value)}
			/>

			<Button
				type='submit'
				variant='primary'
				fullWidth
				loading={pending}
				className={styles.submit}
			>
				{t('auth.reset.submit')}
			</Button>
		</form>
	)
}
