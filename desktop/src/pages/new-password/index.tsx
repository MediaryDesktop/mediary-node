import { useNavigate, useSearch } from '@tanstack/react-router'
import { useCallback, useEffect } from 'react'

import { useTranslation } from '@shared/i18n'
import { useGoBack } from '@shared/lib'

import { AuthFormWrapper, AuthLayout, AuthNewPasswordPanel, passwordResetCompleted } from '@features/auth'

export function NewPasswordPage() {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const goBack = useGoBack('/reset-password')
	const { email } = useSearch({ from: '/new-password' })

	useEffect(() => {
		if (!email) {
			void navigate({ to: '/reset-password' })
		}
	}, [email, navigate])

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
