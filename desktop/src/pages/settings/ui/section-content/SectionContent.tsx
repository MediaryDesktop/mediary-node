import { Link } from '@tanstack/react-router'
import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'

import { nodeHealthQuery } from '@infra/node'

import { BackupSettings, DevicesSettings } from '@features/back-up-node'
import { MissingPlayerNotice, PlayerModeSwitcher } from '@features/choose-player'
import { AniListAccountSettings } from '@features/connect-anilist'
import { DownloadFolderSetting } from '@features/download-chapters'
import { BookFolderSetting } from '@features/download-free-book'
import { DebridServiceSettings } from '@features/manage-debrid-service'
import { LibraryRootsSettings } from '@features/manage-library-roots'
import { OPDSServersSettings } from '@features/manage-opds-servers'
import { AISettings, GoogleBooksSettings, TMDBSettings } from '@features/manage-source-keys'
import { TorrentClientSettings } from '@features/manage-torrent-client'
import { ReleaseProfileSettings, TorznabSourcesSettings } from '@features/manage-torznab-sources'
import { LanguageSwitcher } from '@features/switch-language'
import { ThemeSwitcher } from '@features/switch-theme'

import type { SettingsSection } from '../../config/sections'
import styles from '../../SettingsPage.module.scss'
import { AccountCard } from '../account-card/AccountCard'
import { DeleteAccountCard } from '../delete-account-card/DeleteAccountCard'
import { SettingsCard, SettingsRow } from '../settings-card/SettingsCard'

export function SectionContent({ section }: { section: SettingsSection }) {
	const { t } = useTranslation()

	switch (section) {
		case 'app':
			return (
				<>
					<SettingsCard>
						<SettingsRow
							name={t('settings.appearance.name')}
							hint={t('settings.appearance.hint')}
						>
							<ThemeSwitcher />
						</SettingsRow>
						<SettingsRow name={t('settings.language.name')} hint={t('settings.language.hint')}>
							<LanguageSwitcher />
						</SettingsRow>
						<SettingsRow name={t('settings.player.name')} hint={t('settings.player.hint')}>
							<PlayerModeSwitcher />
						</SettingsRow>
						<MissingPlayerNotice className={styles.cardNotice} />
					</SettingsCard>

					<SettingsCard>
						<SettingsRow name={t('settings.ai.name')} hint={t('settings.ai.hint')} block>
							<AISettings />
						</SettingsRow>
					</SettingsCard>

					<SettingsCard>
						<SettingsRow name={t('settings.wizard.name')} hint={t('settings.wizard.hint')}>
							<Link to='/setup' className={styles.link}>
								{t('settings.wizard.action')}
							</Link>
						</SettingsRow>
						<SettingsRow name={t('settings.node.name')} hint={t('settings.node.hint')}>
							<NodeVersion />
						</SettingsRow>
					</SettingsCard>
				</>
			)
		case 'account':
			return (
				<>
					<AccountCard />
					<AniListAccountSettings />
					<DeleteAccountCard />
				</>
			)
		case 'backup':
			return <BackupSettings />
		case 'devices':
			return <DevicesSettings />
		case 'library':
			return <LibraryRootsSettings />
		case 'metadata':
			return (
				<>
					<TMDBSettings />
					<GoogleBooksSettings />
				</>
			)
		case 'torrents':
			return (
				<>
					<TorrentClientSettings />
					<DebridServiceSettings />
					<TorznabSourcesSettings />
					<ReleaseProfileSettings />
				</>
			)
		case 'manga':
			return (
				<>
					<OPDSServersSettings kind='manga' />

					<SettingsCard>
						<SettingsRow
							name={t('settings.mangaDownloads.name')}
							hint={t('settings.mangaDownloads.hint')}
						>
							<DownloadFolderSetting />
						</SettingsRow>
					</SettingsCard>
				</>
			)
		case 'books':
			return (
				<>
					<OPDSServersSettings kind='books' />

					<SettingsCard>
						<SettingsRow
							name={t('settings.bookDownloads.name')}
							hint={t('settings.bookDownloads.hint')}
						>
							<BookFolderSetting />
						</SettingsRow>
					</SettingsCard>
				</>
			)
	}
}

function NodeVersion() {
	const health = useUnit(nodeHealthQuery.$data)

	return <span className={styles.hint}>{health ? `${health.version} · ${health.commit}` : '—'}</span>
}
