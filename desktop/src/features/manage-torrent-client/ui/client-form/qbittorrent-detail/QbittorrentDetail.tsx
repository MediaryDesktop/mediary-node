import { useUnit } from 'effector-react'
import type { ReactNode } from 'react'

import { useTranslation } from '@shared/i18n'
import { Input } from '@shared/ui'

import type { ClientFields } from '../../../lib/form'
import { clientForm } from '../../../model/form'
import styles from '../TorrentClientForm.module.scss'

export interface QbittorrentDetailProps {
	fields: ClientFields
	hasPassword: boolean
	disabled: boolean
	check: ReactNode
}

export function QbittorrentDetail({ fields, hasPassword, disabled, check }: QbittorrentDetailProps) {
	const { t } = useTranslation()
	const [connectionChanged, mappingChanged] = useUnit([
		clientForm.connectionChanged,
		clientForm.mappingChanged
	])

	const { url, username, password, mapClient, mapNode } = fields

	return (
		<div className={styles.detailStack}>
			<div className={styles.fieldGrid}>
				<label className={styles.field}>
					<span className={styles.fieldLabel}>{t('torrents.settings.urlLabel')}</span>
					<Input
						value={url}
						onChange={event => connectionChanged({ field: 'url', value: event.target.value })}
						disabled={disabled}
						autoComplete='off'
						spellCheck={false}
						placeholder='http://localhost:8080'
					/>
				</label>

				<label className={styles.field}>
					<span className={styles.fieldLabel}>{t('torrents.settings.usernameLabel')}</span>
					<Input
						value={username}
						onChange={event =>
							connectionChanged({ field: 'username', value: event.target.value })
						}
						disabled={disabled}
						autoComplete='off'
						spellCheck={false}
						placeholder='Admin'
					/>
				</label>
			</div>

			<label className={styles.field}>
				<span className={styles.fieldLabel}>{t('torrents.settings.passwordLabel')}</span>
				<Input
					type='password'
					revealable
					value={password}
					onChange={event => connectionChanged({ field: 'password', value: event.target.value })}
					disabled={disabled}
					autoComplete='new-password'
					placeholder={
						hasPassword
							? t('torrents.settings.passwordKept')
							: t('torrents.settings.passwordHint')
					}
				/>
			</label>

			<div className={styles.checkRow}>{check}</div>

			<div className={styles.mappingBlock}>
				<div className={styles.mappingHeader}>
					<span className={styles.detailLabel}>{t('torrents.settings.mappingLabel')}</span>
					<span className={styles.detailHint}>{t('torrents.settings.mappingHint')}</span>
				</div>

				<div className={styles.fieldGrid}>
					<label className={styles.field}>
						<span className={styles.fieldLabel}>{t('torrents.settings.mappingClient')}</span>
						<Input
							value={mapClient}
							onChange={event =>
								mappingChanged({ field: 'mapClient', value: event.target.value })
							}
							disabled={disabled}
							autoComplete='off'
							spellCheck={false}
							placeholder='/downloads'
						/>
					</label>
					<label className={styles.field}>
						<span className={styles.fieldLabel}>{t('torrents.settings.mappingNode')}</span>
						<Input
							value={mapNode}
							onChange={event =>
								mappingChanged({ field: 'mapNode', value: event.target.value })
							}
							disabled={disabled}
							autoComplete='off'
							spellCheck={false}
							placeholder='D:\Anime'
						/>
					</label>
				</div>
			</div>
		</div>
	)
}
