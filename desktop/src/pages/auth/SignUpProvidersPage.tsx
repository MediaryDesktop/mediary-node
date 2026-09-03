import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect } from 'react'

import { useTranslation } from '@shared/i18n'
import { useGoBack } from '@shared/lib'

import { sessionModel } from '@entities/session'

import { AuthFormWrapper, AuthLayout, AuthProvidersPanel } from '@features/auth'

export function SignUpProvidersPage() {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const goBack = useGoBack('/')

	useEffect(() => sessionModel.authenticated.watch(() => navigate({ to: '/' })), [navigate])

	return (
		<AuthLayout onBack={goBack}>
			<AuthFormWrapper
				eyebrow={t('auth.signUp.eyebrow')}
				title={t('auth.signUp.title')}
				description={t('auth.signUp.subtitle')}
			>
				<AuthProvidersPanel
					mode='signUp'
					onUseEmail={useCallback(() => navigate({ to: '/sign-up/email' }), [navigate])}
					onSwitch={useCallback(() => navigate({ to: '/sign-in' }), [navigate])}
				/>
			</AuthFormWrapper>
		</AuthLayout>
	)
}
