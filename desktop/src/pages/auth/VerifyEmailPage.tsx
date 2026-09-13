import { useUnit } from 'effector-react'
import { useCallback } from 'react'

import { useTranslation } from '@shared/i18n'

import { sessionModel } from '@entities/session'

import { AuthFormWrapper, AuthVerifyEmailPanel, CODE_LENGTH, useAuthBack } from '@features/auth'

export function VerifyEmailPage() {
	const { t } = useTranslation()
	const account = useUnit(sessionModel.$account)

	const leave = useCallback(() => sessionModel.signOutRequested(), [])

	useAuthBack(leave)

	return (
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
	)
}
