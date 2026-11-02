import { useUnit } from 'effector-react'
import type { FormEvent } from 'react'
import { useId, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon, Input } from '@shared/ui'

import { aniListAccountModel } from '@entities/anilist-account'
import type { AniListConnectFailure } from '@entities/anilist-account'

import styles from './ConnectAniList.module.scss'

export interface ConnectAniListProps {
	showHeader?: boolean
	// Where "Get a token" appears: in this component's own header, or left out
	// for the caller to place with GetTokenLink — next to a title of its own.
	tokenLink?: 'inline' | 'none'
}

// The "Get a token on AniList" action on its own, for a caller that gives
// AniList its own title elsewhere and wants this next to it.
export function GetTokenLink() {
	const { t } = useTranslation()

	const { authorizeUrl, connected, authorize } = useUnit({
		authorizeUrl: aniListAccountModel.$authorizeUrl,
		connected: aniListAccountModel.$connected,
		authorize: aniListAccountModel.authorizeRequested
	})

	if (connected) {
		return null
	}

	return (
		<button type='button' className={styles.link} disabled={!authorizeUrl} onClick={() => authorize()}>
			{t('anilist.connect.open')}
			<Icon name='common/arrow-right' style={{transform: 'rotate(-45deg)'}} size={16} />
		</button>
	)
}

export function ConnectAniList({ showHeader = true, tokenLink = 'inline' }: ConnectAniListProps) {
	const { t } = useTranslation()

	const { account, connected, disconnecting, disconnect } = useUnit({
		account: aniListAccountModel.$account,
		connected: aniListAccountModel.$connected,
		disconnecting: aniListAccountModel.$disconnecting,
		disconnect: aniListAccountModel.disconnectRequested
	})

	if (!connected) {
		return <TokenForm showHeader={showHeader} tokenLink={tokenLink} />
	}

	return (
		<div className={styles.connected}>
			{account?.avatar_url ? (
				<img className={styles.avatar} src={account.avatar_url} alt='' />
			) : (
				<span className={styles.avatar}>
					<Icon name='common/user' size={18} />
				</span>
			)}

			<span className={styles.name}>
				{t('anilist.connect.connectedAs', { name: account?.name ?? 'AniList' })}
			</span>

			<Button variant='glass-accent' size='small' loading={disconnecting} onClick={() => disconnect()}>
				{t('anilist.connect.disconnect')}
			</Button>
		</div>
	)
}

function TokenForm({ showHeader, tokenLink }: Required<ConnectAniListProps>) {
	const { t } = useTranslation()
	const tokenId = useId()
	const [token, setToken] = useState('')

	const { authorizeUrl, loaded, connecting, failure, connect } = useUnit({
		authorizeUrl: aniListAccountModel.$authorizeUrl,
		loaded: aniListAccountModel.$loaded,
		connecting: aniListAccountModel.$connecting,
		failure: aniListAccountModel.$connectFailure,
		connect: aniListAccountModel.connectRequested
	})

	const failureMessages: Record<AniListConnectFailure, string> = {
		rejected: t('anilist.connect.failure.rejected'),
		unreachable: t('anilist.connect.failure.unreachable'),
		unknown: t('anilist.connect.failure.unknown')
	}

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
					error={failure ? failureMessages[failure] : undefined}
					onChange={event => setToken(event.target.value)}
				/>

				<Button type='submit' variant='primary' loading={connecting} disabled={!token.trim()}>
					{t('anilist.connect.submit')}
				</Button>
			</div>
		</form>
	)
}
