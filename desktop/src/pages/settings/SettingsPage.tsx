import { Link } from '@tanstack/react-router'
import clsx from 'clsx'

import { useTranslation } from '@shared/i18n'

import { PlayerModeSwitcher } from '@features/choose-player'
import { LibraryRootsSettings } from '@features/manage-library-roots'
import { OPDSServersSettings } from '@features/manage-opds-servers'
import { LanguageSwitcher } from '@features/switch-language'
import { ThemeSwitcher } from '@features/switch-theme'

import styles from './SettingsPage.module.scss'

export function SettingsPage() {
	const { t } = useTranslation()

	return (
		<div className={styles.root}>
			<h1 className={styles.title}>{t('nav.settings')}</h1>

			<section className={styles.section}>
				<span className={styles.label}>
					<span className={styles.name}>{t('settings.appearance.name')}</span>
					<span className={styles.hint}>{t('settings.appearance.hint')}</span>
				</span>

				<ThemeSwitcher />
			</section>

			<section className={styles.section}>
				<span className={styles.label}>
					<span className={styles.name}>{t('settings.language.name')}</span>
					<span className={styles.hint}>{t('settings.language.hint')}</span>
				</span>

				<LanguageSwitcher />
			</section>

			<section className={styles.section}>
				<span className={styles.label}>
					<span className={styles.name}>{t('settings.player.name')}</span>
					<span className={styles.hint}>{t('settings.player.hint')}</span>
				</span>

				<PlayerModeSwitcher />
			</section>

			<section className={clsx(styles.section, styles.block)}>
				<span className={styles.label}>
					<span className={styles.name}>{t('settings.library.name')}</span>
					<span className={styles.hint}>{t('settings.library.hint')}</span>
				</span>

				<LibraryRootsSettings />
			</section>

			<section className={clsx(styles.section, styles.block)}>
				<span className={styles.label}>
					<span className={styles.name}>{t('settings.mangaSources.name')}</span>
					<span className={styles.hint}>{t('settings.mangaSources.hint')}</span>
				</span>

				<OPDSServersSettings />
			</section>

			<section className={styles.section}>
				<span className={styles.label}>
					<span className={styles.name}>{t('settings.wizard.name')}</span>
					<span className={styles.hint}>{t('settings.wizard.hint')}</span>
				</span>

				<Link to='/setup' className={styles.link}>
					{t('settings.wizard.action')}
				</Link>
			</section>
		</div>
	)
}
