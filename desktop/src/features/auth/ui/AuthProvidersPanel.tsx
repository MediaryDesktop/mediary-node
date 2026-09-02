import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon } from '@shared/ui'

import { providerLabel, providerLook } from '../lib/providers'
import { oauthPanel } from '../model/oauth'

import { AuthLink } from './AuthLink'
import panel from './AuthPanel.module.scss'
import styles from './AuthProvidersPanel.module.scss'

export interface AuthProvidersPanelProps {
	mode: 'signIn' | 'signUp'
	onUseEmail: () => void
	onSwitch: () => void
}

export function AuthProvidersPanel({ mode, onUseEmail, onSwitch }: AuthProvidersPanelProps) {
	const { t } = useTranslation()
	const [providers, lastUsed, failure, pending] = useUnit([
		oauthPanel.$providers,
		oauthPanel.$lastUsed,
		oauthPanel.$failure,
		oauthPanel.$pending
	])

	useEffect(() => oauthPanel.mounted(), [])

	return (
		<div className={panel.panel}>
			{failure && <p className={styles.failure}>{failure}</p>}

			{providers.length > 0 && (
				<>
					<p className={styles.label}>{t('auth.providers.label')}</p>

					<ul className={styles.providers}>
						{providers.map(provider => {
							const look = providerLook(provider)

							return (
								<li key={provider} className={styles.provider}>
									{lastUsed === provider && (
										<span className={styles.badge}>{t('auth.providers.lastUsed')}</span>
									)}

									<Button
										variant='glass'
										fullWidth
										loading={pending === provider}
										disabled={pending !== null}
										startIcon={look && <Icon name={look.icon} size={20} />}
										onClick={() => oauthPanel.providerChosen(provider)}
									>
										{providerLabel(provider)}
									</Button>
								</li>
							)
						})}
					</ul>

					<div className={panel.divider}>{t('auth.or')}</div>
				</>
			)}

			<Button variant='secondary' fullWidth onClick={onUseEmail}>
				{t(mode === 'signIn' ? 'auth.signIn.useEmail' : 'auth.signUp.useEmail')}
			</Button>

			<div className={panel.links}>
				<AuthLink onClick={onSwitch}>
					{t(mode === 'signIn' ? 'auth.signIn.noAccount' : 'auth.signUp.haveAccount')}{' '}
					{t(mode === 'signIn' ? 'auth.signIn.switch' : 'auth.signUp.switch')}
				</AuthLink>
			</div>
		</div>
	)
}
