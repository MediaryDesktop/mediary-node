import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'

import { useTranslation } from '@shared/i18n'
import { useGoBack } from '@shared/lib'

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
