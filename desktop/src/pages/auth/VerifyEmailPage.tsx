import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useCallback, useEffect } from 'react'

import { useTranslation } from '@shared/i18n'

import { sessionModel } from '@entities/session'

import { AuthFormWrapper, AuthLayout, AuthVerifyEmailPanel, CODE_LENGTH } from '@features/auth'

export function VerifyEmailPage() {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const account = useUnit(sessionModel.$account)

	useEffect(() => {
		if (!account) {
			void navigate({ to: '/sign-in' })
			return
		}

		if (account.email_verified) {
			void navigate({ to: '/' })
		}
	}, [account, navigate])

	useEffect(() => sessionModel.emailVerified.watch(() => navigate({ to: '/' })), [navigate])

	const leave = useCallback(() => {
		sessionModel.signOutRequested()
		void navigate({ to: '/sign-in' })
	}, [navigate])

	return (
		<AuthLayout onBack={leave}>
			<AuthFormWrapper
				eyebrow={t('auth.verify.eyebrow')}
				title={t('auth.verify.title')}
				description={t('auth.verify.description', {
					email: account?.email ?? '',
					length: CODE_LENGTH
				})}
			>
				<AuthVerifyEmailPanel />
			</AuthFormWrapper>
		</AuthLayout>
	)
}
