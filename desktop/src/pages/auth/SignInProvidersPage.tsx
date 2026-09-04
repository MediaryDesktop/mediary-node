import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect } from 'react'

import { useTranslation } from '@shared/i18n'
import { useGoBack } from '@shared/lib'

import { landingRoute, sessionModel } from '@entities/session'

import { AuthFormWrapper, AuthLayout, AuthProvidersPanel } from '@features/auth'

export function SignInProvidersPage() {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const goBack = useGoBack('/')

	useEffect(
		() => sessionModel.authenticated.watch(account => navigate({ to: landingRoute(account) })),
		[navigate]
	)

	return (
		<AuthLayout onBack={goBack}>
			<AuthFormWrapper
				eyebrow={t('auth.signIn.eyebrow')}
				title={t('auth.signIn.title')}
				description={t('auth.signIn.subtitle')}
			>
				<AuthProvidersPanel
					mode='signIn'
					onUseEmail={useCallback(() => navigate({ to: '/sign-in/email' }), [navigate])}
					onSwitch={useCallback(() => navigate({ to: '/sign-up' }), [navigate])}
				/>
			</AuthFormWrapper>
		</AuthLayout>
	)
}
