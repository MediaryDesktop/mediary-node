import { Link, useNavigate } from '@tanstack/react-router'
import clsx from 'clsx'
import { useUnit } from 'effector-react'
import type { ReactNode } from 'react'

import { useTranslation } from '@shared/i18n'
import { PageTransition, renderIcon, RippleButton } from '@shared/ui'

import { nodeHealthQuery } from '@infra/node'

import { BackupSettings, DevicesSettings } from '@features/back-up-node'
import { MissingPlayerNotice, PlayerModeSwitcher } from '@features/choose-player'
import { AniListAccountSettings } from '@features/connect-anilist'
import { DownloadFolderSetting } from '@features/download-chapters'
import { BookFolderSetting } from '@features/download-free-book'
import { BookServersSettings, GutenbergSettings } from '@features/manage-book-sources'
import { DebridServiceSettings } from '@features/manage-debrid-service'
import { LibraryRootsSettings } from '@features/manage-library-roots'
import { OPDSServersSettings } from '@features/manage-opds-servers'
import { AISettings, GoogleBooksSettings, TMDBSettings } from '@features/manage-source-keys'
import { TorrentClientSettings } from '@features/manage-torrent-client'
import { ReleaseProfileSettings, TorznabSourcesSettings } from '@features/manage-torznab-sources'
import { LanguageSwitcher } from '@features/switch-language'
import { ThemeSwitcher } from '@features/switch-theme'

import { SECTION_GROUPS } from './config/sections'
import type { SectionInfo, SettingsSection } from './config/sections'
import styles from './SettingsPage.module.scss'
import { AccountCard } from './ui/account-card/AccountCard'

export interface SettingsPageProps {
	section: SettingsSection
}

// Settings as Seanime lays them out: sections grouped in a menu on the left, the
// open one on the right under its own header, its settings as rows in cards.
export function SettingsPage({ section }: SettingsPageProps) {
	const { t } = useTranslation()
	const navigate = useNavigate()

	const current = SECTION_GROUPS.flat().find(item => item.id === section) ?? SECTION_GROUPS[0]![0]!

	return (
		<PageTransition className={styles.root}>
			<nav className={styles.nav} aria-label={t('nav.settings')}>
				{SECTION_GROUPS.map(group => (
					<ul key={group[0]!.id} className={styles.group}>
						{group.map(item => (
							<li key={item.id}>
								<RippleButton
									className={clsx(styles.item, item.id === current.id && styles.active)}
									aria-current={item.id === current.id ? 'page' : undefined}
									onClick={() =>
										// Replaces: switching sections should not pile up history entries
										// that "back" would have to walk through one at a time.
										navigate({
											to: '/settings',
											search: { section: item.id },
											replace: true
										})
									}
								>
									{renderIcon(item.icon, 18)}
									{t(`settings.sections.${item.key}.title`)}
								</RippleButton>
							</li>
						))}
					</ul>
				))}
			</nav>

			<section className={styles.panel}>
				<header className={styles.header}>
					<span className={styles.headerIcon}>{renderIcon(current.icon, 24)}</span>
					<div>
						<h2 className={styles.headerTitle}>{t(`settings.sections.${current.key}.title`)}</h2>
						<p className={styles.headerSubtitle}>
							{t(`settings.sections.${current.key}.subtitle`)}
						</p>
					</div>
				</header>

				<SectionContent section={current} />
			</section>
		</PageTransition>
	)
}

function SectionContent({ section }: { section: SectionInfo }) {
	const { t } = useTranslation()

	switch (section.id) {
		case 'app':
			return (
				<Card>
					<Row name={t('settings.appearance.name')} hint={t('settings.appearance.hint')}>
						<ThemeSwitcher />
					</Row>
					<Row name={t('settings.language.name')} hint={t('settings.language.hint')}>
						<LanguageSwitcher />
					</Row>
					<Row name={t('settings.wizard.name')} hint={t('settings.wizard.hint')}>
						<Link to='/setup' className={styles.link}>
							{t('settings.wizard.action')}
						</Link>
					</Row>
					<Row name={t('settings.node.name')} hint={t('settings.node.hint')}>
						<NodeVersion />
					</Row>
					<Row name={t('settings.ai.name')} hint={t('settings.ai.hint')} block>
						<AISettings />
					</Row>
					<Row name={t('settings.player.name')} hint={t('settings.player.hint')}>
						<PlayerModeSwitcher />
					</Row>
					<MissingPlayerNotice className={styles.cardNotice} />
				</Card>
			)
		case 'account':
			return (
				<>
					<AccountCard />
					<AniListAccountSettings />
				</>
			)
		case 'backup':
			return (
				<Card>
					<Row name={t('settings.backup.name')} hint={t('settings.backup.hint')} block>
						<BackupSettings />
					</Row>
				</Card>
			)
		case 'devices':
			return (
				<Card>
					<Row name={t('settings.devices.name')} hint={t('settings.devices.hint')} block>
						<DevicesSettings />
					</Row>
				</Card>
			)
		case 'library':
			return (
				<Card>
					<Row name={t('settings.library.name')} hint={t('settings.library.hint')} block>
						<LibraryRootsSettings />
					</Row>
				</Card>
			)
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
				<Card>
					<Row name={t('settings.mangaSources.name')} hint={t('settings.mangaSources.hint')} block>
						<OPDSServersSettings />
					</Row>
					<Row name={t('settings.mangaDownloads.name')} hint={t('settings.mangaDownloads.hint')}>
						<DownloadFolderSetting />
					</Row>
				</Card>
			)
		case 'books':
			return (
				<Card>
					<Row name={t('settings.gutenberg.name')} hint={t('settings.gutenberg.hint')} block>
						<GutenbergSettings />
					</Row>
					<Row name={t('settings.bookServers.name')} hint={t('settings.bookServers.hint')} block>
						<BookServersSettings />
					</Row>
					<Row name={t('settings.bookDownloads.name')} hint={t('settings.bookDownloads.hint')}>
						<BookFolderSetting />
					</Row>
				</Card>
			)
	}
}

function NodeVersion() {
	const health = useUnit(nodeHealthQuery.$data)

	return <span className={styles.hint}>{health ? `${health.version} · ${health.commit}` : '—'}</span>
}

function Card({ children }: { children: ReactNode }) {
	return <div className={styles.card}>{children}</div>
}

interface RowProps {
	name: string
	hint: string
	// A list or a form does not fit beside its label, so it goes under it.
	block?: boolean
	children: ReactNode
}

function Row({ name, hint, block, children }: RowProps) {
	return (
		<div className={clsx(styles.row, block && styles.block)}>
			<div className={styles.label}>
				<div className={styles.labelText}>
					<span className={styles.name}>{name}</span>
					<span className={styles.hint}>{hint}</span>
				</div>
			</div>
			<div className={styles.control}>{children}</div>
		</div>
	)
}
