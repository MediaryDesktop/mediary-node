import { useTranslation } from '@shared/i18n'
import { Icon, Input, Select } from '@shared/ui'

import { SetupCard } from '../common'

import styles from './SetupDownloadingStep.module.scss'

export function SetupDownloadingStep() {
	const { t } = useTranslation()

	return (
		<>
			<SetupCard
				icon={<Icon name='common/download' size={18} />}
				title={t('setup.downloading.client.title')}
				description={t('setup.downloading.client.description')}
			>
				<div className={styles.field}>
					<span className={styles.label}>{t('setup.downloading.client.label')}</span>

					<Select
						defaultValue='qbittorrent'
						options={[{ value: 'qbittorrent', label: t('setup.downloading.client.qbittorrent') }]}
					/>
				</div>
			</SetupCard>

			<SetupCard
				icon={
					<span className={styles.qbBadge} aria-hidden>
						qb
					</span>
				}
				title={t('setup.downloading.qbittorrent.title')}
			>
				<div className={styles.grid3}>
					<div className={styles.field}>
						<span className={styles.label}>{t('setup.downloading.qbittorrent.host')}</span>
						<Input defaultValue='127.0.0.1' />
					</div>

					<div className={styles.field}>
						<span className={styles.label}>{t('setup.downloading.qbittorrent.username')}</span>
						<Input />
					</div>

					<div className={styles.field}>
						<span className={styles.label}>{t('setup.downloading.qbittorrent.password')}</span>
						<Input type='password' revealable />
					</div>
				</div>

				<div className={styles.grid2}>
					<div className={styles.field}>
						<span className={styles.label}>{t('setup.downloading.qbittorrent.port')}</span>
						<Input type='number' defaultValue={8081} />
					</div>

					<div className={styles.field}>
						<span className={styles.label}>{t('setup.downloading.qbittorrent.executable')}</span>
						<Input defaultValue='C:/Program Files/qBittorrent/qbittorrent.exe' />
					</div>
				</div>
			</SetupCard>
		</>
	)
}
