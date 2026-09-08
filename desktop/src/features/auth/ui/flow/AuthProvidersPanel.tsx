import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon } from '@shared/ui'

import { providerLabel, providerLook } from '../../lib'
import { oauthPanel } from '../../model'
import { AuthLink } from '../common'

import panel from './AuthPanel.module.scss'
import styles from './AuthProvidersPanel.module.scss'

export interface AuthProvidersPanelProps {
	mode: 'signIn' | 'signUp'
	onUseEmail: () => void
	onSwitch: () => void
}

export function AuthProvidersPanel({ mode, onUseEmail, onSwitch }: AuthProvidersPanelProps) {
	const { t } = useTranslation()
	const [providers, lastUsed, pending, starting, unavailable] = useUnit([
		oauthPanel.$providers,
		oauthPanel.$lastUsed,
		oauthPanel.$pending,
		oauthPanel.$starting,
		oauthPanel.$unavailable
	])

	useEffect(() => oauthPanel.mounted(), [])

	return (
		<div className={panel.panel}>
			{providers.length > 0 && (
				<>
					<p className={styles.label}>{t('auth.providers.label')}</p>

					<ul className={styles.providers}>
						{providers.map(provider => {
							const look = providerLook(provider)
							const remembered = lastUsed === provider

							return (
								<li key={provider} className={styles.provider}>
									{remembered && (
										<span className={styles.badge}>{t('auth.providers.lastUsed')}</span>
									)}

									<Button
										variant={remembered ? 'glass-accent' : 'glass'}
										fullWidth
										loading={pending === provider}
										disabled={starting}
										startIcon={look && <Icon name={look.icon} size={20} />}
										onClick={() => oauthPanel.providerChosen(provider)}
										className={styles.providerBtn}
									>
										{providerLabel(provider)}
									</Button>
								</li>
							)
						})}
					</ul>

					{pending !== null && (
						<p className={styles.waiting}>
							{t('auth.providers.waiting', { provider: providerLabel(pending) })}{' '}
							<AuthLink onClick={oauthPanel.cancelled} disabled={starting}>
								{t('auth.providers.cancel')}
							</AuthLink>
						</p>
					)}

					<div className={panel.divider}>{t('auth.or')}</div>
				</>
			)}

			{providers.length === 0 && unavailable && (
				<p className={styles.waiting}>
					{t('auth.providers.unavailable')}{' '}
					<AuthLink onClick={oauthPanel.reloadRequested}>{t('auth.providers.reload')}</AuthLink>
				</p>
			)}

			<Button variant='glass' fullWidth onClick={onUseEmail}>
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
