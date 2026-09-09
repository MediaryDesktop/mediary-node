import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect } from 'react'

import { useTranslation } from '@shared/i18n'
import { useGoBack } from '@shared/lib'

import { AuthFormWrapper, AuthLayout, AuthNewPasswordPanel, passwordResetCompleted } from '@features/auth'

export interface NewPasswordPageProps {
	email: string
}

export function NewPasswordPage({ email }: NewPasswordPageProps) {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const goBack = useGoBack('/reset-password')

	useEffect(() => passwordResetCompleted.watch(() => navigate({ to: '/sign-in/email' })), [navigate])

	return (
		<AuthLayout onBack={goBack}>
			<AuthFormWrapper
				eyebrow={t('auth.newPassword.eyebrow')}
				title={t('auth.newPassword.title')}
				description={t('auth.newPassword.description', { email })}
			>
				<AuthNewPasswordPanel
					email={email}
					onRequestAnother={useCallback(() => navigate({ to: '/reset-password' }), [navigate])}
					onBackToSignIn={useCallback(() => navigate({ to: '/sign-in/email' }), [navigate])}
				/>
			</AuthFormWrapper>
		</AuthLayout>
	)
}
