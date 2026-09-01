import { useNavigate, useRouter } from '@tanstack/react-router'
import { useCallback, useEffect } from 'react'

import { sessionModel } from '@entities/session'

import { AuthLayout, SignUpForm } from '@features/auth'
import { LanguageSwitcher } from '@features/switch-language'

export function SignUpPage() {
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
			<SignUpForm onSwitchToSignIn={useCallback(() => navigate({ to: '/sign-in' }), [navigate])} />
		</AuthLayout>
	)
}
