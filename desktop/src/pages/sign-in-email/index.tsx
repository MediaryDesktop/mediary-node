import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect } from 'react'

import { useTranslation } from '@shared/i18n'
import { useGoBack } from '@shared/lib'

import { sessionModel } from '@entities/session'

import { AuthEmailPanel, AuthFormWrapper, AuthLayout } from '@features/auth'

export function SignInEmailPage() {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const goBack = useGoBack('/sign-in')

	useEffect(() => sessionModel.authenticated.watch(() => navigate({ to: '/' })), [navigate])

	return (
		<AuthLayout onBack={goBack}>
			<AuthFormWrapper
				eyebrow={t('auth.signIn.eyebrow')}
				title={t('auth.signIn.emailTitle')}
				description={t('auth.signIn.emailSubtitle')}
			>
				<AuthEmailPanel
					mode='signIn'
					onUseProviders={useCallback(() => navigate({ to: '/sign-in' }), [navigate])}
					onSwitch={useCallback(() => navigate({ to: '/sign-up/email' }), [navigate])}
					onForgotPassword={useCallback(() => navigate({ to: '/reset-password' }), [navigate])}
				/>
			</AuthFormWrapper>
		</AuthLayout>
	)
}
