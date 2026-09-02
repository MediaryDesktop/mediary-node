import { useTranslation } from '@shared/i18n'

import { AuthLink } from './AuthLink'
import panel from './AuthPanel.module.scss'
import { VerifyEmailForm } from './VerifyEmailForm'

export interface AuthVerifyEmailPanelProps {
	onLater: () => void
}

export function AuthVerifyEmailPanel({ onLater }: AuthVerifyEmailPanelProps) {
	const { t } = useTranslation()

	return (
		<div className={panel.panel}>
			<VerifyEmailForm />

			<div className={panel.links}>
				<AuthLink tone='muted' onClick={onLater}>
					{t('auth.verify.later')}
				</AuthLink>
			</div>
		</div>
	)
}
