import { useUnit } from 'effector-react'
import type { FormEvent } from 'react'
import { useId, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Button, Icon, Input, toast } from '@shared/ui'

import { aniListAccountModel } from '@entities/anilist-account'
import type { AniListConnectFailure } from '@entities/anilist-account'

import styles from '../../ConnectAniList.module.scss'
import { GetTokenLink } from '../get-token-link/GetTokenLink'

export interface TokenFormProps {
	showHeader: boolean
	tokenLink: 'inline' | 'none'
}

export function TokenForm({ showHeader, tokenLink }: TokenFormProps) {
	const { t } = useTranslation()
	const tokenId = useId()
	const [token, setToken] = useState('')

	const { authorizeUrl, loaded, connecting, connect } = useUnit({
		authorizeUrl: aniListAccountModel.$authorizeUrl,
		loaded: aniListAccountModel.$loaded,
		connecting: aniListAccountModel.$connecting,
		connect: aniListAccountModel.connectRequested
	})

	const failureMessages: Record<AniListConnectFailure, string> = {
		rejected: t('anilist.connect.failure.rejected'),
		unreachable: t('anilist.connect.failure.unreachable'),
		unknown: t('anilist.connect.failure.unknown')
	}

	useUnitWatch(aniListAccountModel.connectFailed, failure =>
		toast.error(failureMessages[failure], { id: 'anilist-connect-failed' })
	)

	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		connect(token)
	}

	return (
		<form className={styles.form} onSubmit={submit}>
			{showHeader && (
				<header className={styles.header}>
					<div className={styles.headerText}>
						<h3 className={styles.title}>{t('anilist.connect.title')}</h3>
						<p className={styles.description}>{t('anilist.connect.description')}</p>
					</div>

					{tokenLink === 'inline' && <GetTokenLink />}
				</header>
			)}

			{tokenLink === 'inline' && !showHeader && <GetTokenLink />}

			{loaded && !authorizeUrl && (
				<p className={styles.notice}>
					<Icon name='common/info' size={16} />
					{t('anilist.connect.notConfigured')}
				</p>
			)}

			<div className={styles.tokenRow}>
				<Input
					id={tokenId}
					className={styles.tokenField}
					type='password'
					revealable
					autoComplete='off'
					spellCheck={false}
					value={token}
					placeholder={t('anilist.connect.tokenPlaceholder')}
					onChange={event => setToken(event.target.value)}
					startIcon={<Icon name='common/lock' size={18} />}
				/>

				<Button type='submit' variant='primary' loading={connecting} disabled={!token.trim()}>
					{t('anilist.connect.submit')}
				</Button>
			</div>
		</form>
	)
}
