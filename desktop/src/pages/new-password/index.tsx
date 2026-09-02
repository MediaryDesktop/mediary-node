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

	// Reached without an address — a hand-typed URL, or a link that lost its
	// query. There is no code to spend, so the step starts over.
	useEffect(() => {
		if (!email) {
			void navigate({ to: '/reset-password' })
		}
	}, [email, navigate])

	// The reset ended every session the account had, so the way on is the form.
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
