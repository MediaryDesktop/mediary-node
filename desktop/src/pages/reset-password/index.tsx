import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect } from 'react'

import { useTranslation } from '@shared/i18n'
import { useGoBack } from '@shared/lib'

import { AuthFormWrapper, AuthLayout, AuthResetPasswordPanel, passwordResetSent } from '@features/auth'

export function ResetPasswordPage() {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const goBack = useGoBack('/sign-in/email')

	useEffect(
		() =>
			passwordResetSent.watch(email => {
				void navigate({ to: '/new-password', search: { email } })
			}),
		[navigate]
	)

	return (
		<AuthLayout onBack={goBack}>
			<AuthFormWrapper
				eyebrow={t('auth.reset.eyebrow')}
				title={t('auth.reset.title')}
				description={t('auth.reset.description')}
			>
				<AuthResetPasswordPanel
					onBackToSignIn={useCallback(() => navigate({ to: '/sign-in/email' }), [navigate])}
				/>
			</AuthFormWrapper>
		</AuthLayout>
	)
}
