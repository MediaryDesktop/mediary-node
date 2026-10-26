import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'

import { useTranslation } from '@shared/i18n'
import { useGoBack } from '@shared/lib'

import { AuthFormWrapper, AuthNewPasswordPanel, useAuthBack } from '@features/auth'

export interface NewPasswordPageProps {
	email: string
}

export function NewPasswordPage({ email }: NewPasswordPageProps) {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const goBack = useGoBack('/reset-password')

	useAuthBack(goBack)

	return (
		<AuthFormWrapper
			eyebrow={t('auth.newPassword.eyebrow')}
			title={t('auth.newPassword.title')}
			description={t('auth.newPassword.description', { email })}
		>
			<AuthNewPasswordPanel
				email={email}
				onRequestAnother={useCallback(
					() => navigate({ to: '/reset-password', replace: true }),
					[navigate]
				)}
				onBackToSignIn={useCallback(
					() => navigate({ to: '/sign-in/email', replace: true }),
					[navigate]
				)}
			/>
		</AuthFormWrapper>
	)
}
