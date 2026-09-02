import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useCallback, useEffect } from 'react'

import { useTranslation } from '@shared/i18n'
import { useGoBack } from '@shared/lib'

import { sessionModel } from '@entities/session'

import { AuthFormWrapper, AuthLayout, AuthVerifyEmailPanel, CODE_LENGTH } from '@features/auth'

export function VerifyEmailPage() {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const goBack = useGoBack('/')
	const account = useUnit(sessionModel.$account)

	// The code is spent against the session, so there is nothing to confirm
	// without one — and nothing to confirm twice.
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

	return (
		<AuthLayout onBack={goBack}>
			<AuthFormWrapper
				eyebrow={t('auth.verify.eyebrow')}
				title={t('auth.verify.title')}
				description={t('auth.verify.description', {
					email: account?.email ?? '',
					length: CODE_LENGTH
				})}
			>
				<AuthVerifyEmailPanel onLater={useCallback(() => navigate({ to: '/' }), [navigate])} />
			</AuthFormWrapper>
		</AuthLayout>
	)
}
