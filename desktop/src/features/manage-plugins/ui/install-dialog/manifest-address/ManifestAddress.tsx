import { LuCopy } from 'react-icons/lu'

import { useTranslation } from '@shared/i18n'
import { toast, Tooltip } from '@shared/ui'

import styles from './ManifestAddress.module.scss'

export function ManifestAddress({ url }: { url: string }) {
	const { t } = useTranslation()

	const copy = () => {
		navigator.clipboard
			.writeText(url)
			.then(() => toast.success(t('plugins.dialog.copied'), { duration: 1500 }))
			.catch(() => undefined)
	}

	return (
		<div className={styles.manifest}>
			<span className={styles.manifestLabel}>{t('plugins.dialog.source')}</span>
			<div className={styles.manifestRow}>
				<span className={styles.manifestUrl} title={url}>
					{url.replace(/^https:\/\//u, '')}
				</span>
				<Tooltip content={t('plugins.dialog.copy')}>
					<button
						type='button'
						className={styles.copy}
						aria-label={t('plugins.dialog.copy')}
						onClick={copy}
					>
						<LuCopy size={12} />
					</button>
				</Tooltip>
			</div>
		</div>
	)
}
