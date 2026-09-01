import { useNavigate, useRouter } from '@tanstack/react-router'
import { useCallback, useEffect } from 'react'

import { sessionModel } from '@entities/session'

import { AuthLayout, SignInForm } from '@features/auth'
import { LanguageSwitcher } from '@features/switch-language'

export function SignInPage() {
	const navigate = useNavigate()
	const router = useRouter()

	useEffect(() => sessionModel.authenticated.watch(() => navigate({ to: '/' })), [navigate])

	const goBack = useCallback(() => {
		if (router.history.canGoBack()) {
			router.history.back()
			return
		}

		navigate({ to: '/' })
	}, [navigate, router])

	return (
		<AuthLayout actions={<LanguageSwitcher />} onBack={goBack}>
			<SignInForm onSwitchToSignUp={useCallback(() => navigate({ to: '/sign-up' }), [navigate])} />
		</AuthLayout>
	)
}
