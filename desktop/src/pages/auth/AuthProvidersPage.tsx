import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect } from 'react'

import { useTranslation } from '@shared/i18n'
import { useGoBack } from '@shared/lib'

import { landingRoute, sessionModel } from '@entities/session'

import { AuthFormWrapper, AuthLayout, AuthProvidersPanel } from '@features/auth'

import { AUTH_MODES, type AuthMode } from './modes'

export interface AuthProvidersPageProps {
	mode: AuthMode
}

export function AuthProvidersPage({ mode }: AuthProvidersPageProps) {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const copy = AUTH_MODES[mode]
	const goBack = useGoBack('/')

	useEffect(
		() => sessionModel.authenticated.watch(account => navigate({ to: landingRoute(account) })),
		[navigate]
	)

	return (
		<AuthLayout onBack={goBack}>
			<AuthFormWrapper eyebrow={t(copy.eyebrow)} title={t(copy.title)} description={t(copy.subtitle)}>
				<AuthProvidersPanel
					mode={mode}
					onUseEmail={useCallback(() => navigate({ to: copy.emailRoute }), [navigate, copy])}
					onSwitch={useCallback(() => navigate({ to: copy.otherRoute }), [navigate, copy])}
				/>
			</AuthFormWrapper>
		</AuthLayout>
	)
}
