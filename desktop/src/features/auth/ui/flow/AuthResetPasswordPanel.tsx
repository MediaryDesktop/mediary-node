import { useTranslation } from '@shared/i18n'

import { AuthLink } from '../common'
import { ResetPasswordForm } from '../form'

import panel from './AuthPanel.module.scss'

export interface AuthResetPasswordPanelProps {
	onBackToSignIn: () => void
}

export function AuthResetPasswordPanel({ onBackToSignIn }: AuthResetPasswordPanelProps) {
	const { t } = useTranslation()

	return (
		<div className={panel.panel}>
			<ResetPasswordForm />

			<div className={panel.divider}>{t('auth.or')}</div>

			<div className={panel.links}>
				<AuthLink onClick={onBackToSignIn}>{t('auth.reset.backToSignIn')}</AuthLink>
			</div>
		</div>
	)
}
