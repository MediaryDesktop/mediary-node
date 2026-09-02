import { useTranslation } from '@shared/i18n'

import { AuthLink } from './AuthLink'
import panel from './AuthPanel.module.scss'
import { NewPasswordForm } from './NewPasswordForm'

export interface AuthNewPasswordPanelProps {
	email: string
	onRequestAnother: () => void
	onBackToSignIn: () => void
}

export function AuthNewPasswordPanel({ email, onRequestAnother, onBackToSignIn }: AuthNewPasswordPanelProps) {
	const { t } = useTranslation()

	return (
		<div className={panel.panel}>
			<NewPasswordForm email={email} />

			<div className={panel.divider}>{t('auth.or')}</div>

			<div className={panel.links}>
				<AuthLink onClick={onRequestAnother}>{t('auth.newPassword.requestAnother')}</AuthLink>
				<AuthLink onClick={onBackToSignIn}>{t('auth.newPassword.remembered')}</AuthLink>
			</div>
		</div>
	)
}
