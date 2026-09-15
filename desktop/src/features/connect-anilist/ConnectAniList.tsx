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
}

export function ConnectAniList({ showHeader = true }: ConnectAniListProps) {
	const { t } = useTranslation()

	const { account, connected, disconnecting, disconnect } = useUnit({
		account: aniListAccountModel.$account,
		connected: aniListAccountModel.$connected,
		disconnecting: aniListAccountModel.$disconnecting,
		disconnect: aniListAccountModel.disconnectRequested
	})

	if (!connected) {
		return <TokenForm showHeader={showHeader} />
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

			<Button variant='ghost' size='small' loading={disconnecting} onClick={() => disconnect()}>
				{t('anilist.connect.disconnect')}
			</Button>
		</div>
	)
}

function TokenForm({ showHeader }: Required<ConnectAniListProps>) {
	const { t } = useTranslation()
	const tokenId = useId()
	const [token, setToken] = useState('')

	const { authorizeUrl, loaded, connecting, failure, authorize, connect } = useUnit({
		authorizeUrl: aniListAccountModel.$authorizeUrl,
		loaded: aniListAccountModel.$loaded,
		connecting: aniListAccountModel.$connecting,
		failure: aniListAccountModel.$connectFailure,
		authorize: aniListAccountModel.authorizeRequested,
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
					<h3 className={styles.title}>{t('anilist.connect.title')}</h3>
					<p className={styles.description}>{t('anilist.connect.description')}</p>
				</header>
			)}

			<Button
				type='button'
				variant='glass-accent'
				fullWidth
				disabled={!authorizeUrl}
				endIcon={<Icon name='common/arrow-right' size={16} />}
				onClick={() => authorize()}
			>
				{t('anilist.connect.open')}
			</Button>

			{loaded && !authorizeUrl && (
				<p className={styles.notice}>
					<Icon name='common/info' size={16} />
					{t('anilist.connect.notConfigured')}
				</p>
			)}

			<label className={styles.label} htmlFor={tokenId}>
				{t('anilist.connect.tokenLabel')}
			</label>

			<Input
				id={tokenId}
				type='password'
				revealable
				autoComplete='off'
				spellCheck={false}
				value={token}
				placeholder={t('anilist.connect.tokenPlaceholder')}
				error={failure ? failureMessages[failure] : undefined}
				onChange={event => setToken(event.target.value)}
			/>

			<p className={styles.hint}>{t('anilist.connect.tokenHint')}</p>

			<Button type='submit' variant='primary' fullWidth loading={connecting} disabled={!token.trim()}>
				{t('anilist.connect.submit')}
			</Button>
		</form>
	)
}
