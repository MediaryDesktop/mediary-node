import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'

import { useTranslation } from '@shared/i18n'
import { useGoBack } from '@shared/lib'

import { AuthFormWrapper, AuthResetPasswordPanel, useAuthBack } from '@features/auth'

export function ResetPasswordPage() {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const goBack = useGoBack('/sign-in/email')

	useAuthBack(goBack)

	return (
		<AuthFormWrapper
			eyebrow={t('auth.reset.eyebrow')}
			title={t('auth.reset.title')}
			description={t('auth.reset.description')}
		>
			<AuthResetPasswordPanel
				onBackToSignIn={useCallback(() => navigate({ to: '/sign-in/email' }), [navigate])}
			/>
		</AuthFormWrapper>
	)
}
