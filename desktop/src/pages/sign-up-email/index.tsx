import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect } from 'react'

import { useTranslation } from '@shared/i18n'
import { useGoBack } from '@shared/lib'

import { sessionModel } from '@entities/session'

import { AuthEmailPanel, AuthFormWrapper, AuthLayout } from '@features/auth'

export function SignUpEmailPage() {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const goBack = useGoBack('/sign-up')

	// Registration signs the account in and leaves the address unconfirmed, so
	// the session it establishes leads to the code screen rather than home.
	useEffect(() => sessionModel.authenticated.watch(() => navigate({ to: '/verify-email' })), [navigate])

	return (
		<AuthLayout onBack={goBack}>
			<AuthFormWrapper
				eyebrow={t('auth.signUp.eyebrow')}
				title={t('auth.signUp.emailTitle')}
				description={t('auth.signUp.emailSubtitle')}
			>
				<AuthEmailPanel
					mode='signUp'
					onUseProviders={useCallback(() => navigate({ to: '/sign-up' }), [navigate])}
					onSwitch={useCallback(() => navigate({ to: '/sign-in/email' }), [navigate])}
					onForgotPassword={useCallback(() => navigate({ to: '/reset-password' }), [navigate])}
				/>
			</AuthFormWrapper>
		</AuthLayout>
	)
}
