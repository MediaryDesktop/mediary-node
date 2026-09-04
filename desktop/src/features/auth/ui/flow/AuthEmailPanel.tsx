import { useTranslation } from '@shared/i18n'

import { AuthLink } from '../common'
import { SignInForm, SignUpForm } from '../form'

import panel from './AuthPanel.module.scss'

export interface AuthEmailPanelProps {
	mode: 'signIn' | 'signUp'
	onUseProviders: () => void
	onSwitch: () => void
	onForgotPassword: () => void
}

export function AuthEmailPanel({ mode, onUseProviders, onSwitch, onForgotPassword }: AuthEmailPanelProps) {
	const { t } = useTranslation()

	return (
		<div className={panel.panel}>
			{mode === 'signIn' ? <SignInForm onForgotPassword={onForgotPassword} /> : <SignUpForm />}

			<div className={panel.divider}>{t('auth.or')}</div>

			<div className={panel.links}>
				<AuthLink onClick={onUseProviders}>{t('auth.otherWay')}</AuthLink>

				<AuthLink onClick={onSwitch}>
					{t(mode === 'signIn' ? 'auth.signIn.noAccount' : 'auth.signUp.haveAccount')}{' '}
					{t(mode === 'signIn' ? 'auth.signIn.switch' : 'auth.signUp.switch')}
				</AuthLink>
			</div>
		</div>
	)
}
