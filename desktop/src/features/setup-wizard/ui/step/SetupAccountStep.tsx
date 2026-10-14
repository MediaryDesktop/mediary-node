import type { ReactNode } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon } from '@shared/ui'

import { SetupCard } from '../layout'

import styles from './SetupAccountStep.module.scss'

export interface SetupAccountStepProps {
	// What a signed-in user sees instead of the sign-in buttons — the backup
	// switch, which lives in another feature and is composed in by the page.
	signedIn: ReactNode | null
	onSignIn: () => void
	onSignUp: () => void
}

export function SetupAccountStep({ signedIn, onSignIn, onSignUp }: SetupAccountStepProps) {
	const { t } = useTranslation()

	return (
		<SetupCard>
			<div className={styles.step}>
				<p className={styles.blurb}>{t('setup.account.blurb')}</p>

				{signedIn ?? (
					<>
						<Button
							variant='glass'
							fullWidth
							startIcon={<Icon name='common/user' size={18} />}
							onClick={onSignIn}
						>
							{t('setup.account.signIn')}
						</Button>

						<div className={styles.divider}>{t('setup.account.or')}</div>

						<Button
							variant='ghost'
							fullWidth
							startIcon={<Icon name='common/mail' size={18} />}
							onClick={onSignUp}
						>
							{t('setup.account.signUp')}
						</Button>
					</>
				)}
			</div>
		</SetupCard>
	)
}
