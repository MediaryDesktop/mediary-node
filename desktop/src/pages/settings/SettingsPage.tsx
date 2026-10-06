import { Link } from '@tanstack/react-router'
import clsx from 'clsx'

import { useTranslation } from '@shared/i18n'

import { PlayerModeSwitcher } from '@features/choose-player'
import { DownloadFolderSetting } from '@features/download-chapters'
import { LibraryRootsSettings } from '@features/manage-library-roots'
import { MangaDexSettings } from '@features/manage-mangadex'
import { OPDSServersSettings } from '@features/manage-opds-servers'
import { TorrentClientSettings } from '@features/manage-torrent-client'
import { ReleaseProfileSettings, TorznabSourcesSettings } from '@features/manage-torznab-sources'
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

			<section className={clsx(styles.section, styles.block)}>
				<span className={styles.label}>
					<span className={styles.name}>{t('settings.mangaDex.name')}</span>
					<span className={styles.hint}>{t('settings.mangaDex.hint')}</span>
				</span>

				<MangaDexSettings />
			</section>

			<section className={styles.section}>
				<span className={styles.label}>
					<span className={styles.name}>{t('settings.mangaDownloads.name')}</span>
					<span className={styles.hint}>{t('settings.mangaDownloads.hint')}</span>
				</span>

				<DownloadFolderSetting />
			</section>

			<section className={clsx(styles.section, styles.block)}>
				<span className={styles.label}>
					<span className={styles.name}>{t('settings.torrents.name')}</span>
					<span className={styles.hint}>{t('settings.torrents.hint')}</span>
				</span>

				<TorrentClientSettings />
			</section>

			<section className={clsx(styles.section, styles.block)}>
				<span className={styles.label}>
					<span className={styles.name}>{t('settings.torrentSearch.name')}</span>
					<span className={styles.hint}>{t('settings.torrentSearch.hint')}</span>
				</span>

				<TorznabSourcesSettings />
			</section>

			<section className={clsx(styles.section, styles.block)}>
				<span className={styles.label}>
					<span className={styles.name}>{t('settings.releaseProfile.name')}</span>
					<span className={styles.hint}>{t('settings.releaseProfile.hint')}</span>
				</span>

				<ReleaseProfileSettings />
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
