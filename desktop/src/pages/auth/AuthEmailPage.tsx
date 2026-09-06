import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect } from 'react'

import { useTranslation } from '@shared/i18n'
import { useGoBack } from '@shared/lib'

import { landingRoute, sessionModel } from '@entities/session'

import { AuthEmailPanel, AuthFormWrapper, AuthLayout } from '@features/auth'

import { AUTH_MODES, type AuthMode } from './modes'

export interface AuthEmailPageProps {
	mode: AuthMode
}

export function AuthEmailPage({ mode }: AuthEmailPageProps) {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const copy = AUTH_MODES[mode]
	const goBack = useGoBack(copy.providersRoute)

	useEffect(
		() => sessionModel.authenticated.watch(account => navigate({ to: landingRoute(account) })),
		[navigate]
	)

	return (
		<AuthLayout onBack={goBack}>
			<AuthFormWrapper
				eyebrow={t(copy.eyebrow)}
				title={t(copy.emailTitle)}
				description={t(copy.emailSubtitle)}
			>
				<AuthEmailPanel
					mode={mode}
					onUseProviders={useCallback(
						() => navigate({ to: copy.providersRoute }),
						[navigate, copy]
					)}
					onSwitch={useCallback(() => navigate({ to: copy.otherEmailRoute }), [navigate, copy])}
					onForgotPassword={useCallback(() => navigate({ to: '/reset-password' }), [navigate])}
				/>
			</AuthFormWrapper>
		</AuthLayout>
	)
}
