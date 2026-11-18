import { useTranslation } from '@shared/i18n'

import styles from './Hosts.module.scss'

export interface HostsProps {
	hosts: string[]
}

export function Hosts({ hosts }: HostsProps) {
	const { t } = useTranslation()

	return (
		<p className={styles.hosts} title={hosts.join(', ')}>
			{hosts.length > 0 ? t('plugins.hosts', { hosts: hosts.join(', ') }) : t('plugins.noHosts')}
		</p>
	)
}
