import { Link, useNavigate } from '@tanstack/react-router'
import clsx from 'clsx'
import type { ReactNode } from 'react'

import { useTranslation } from '@shared/i18n'
import { PageTransition, renderIcon, RippleButton } from '@shared/ui'

import { PlayerModeSwitcher } from '@features/choose-player'
import { DownloadFolderSetting } from '@features/download-chapters'
import { LibraryRootsSettings } from '@features/manage-library-roots'
import { MangaDexSettings } from '@features/manage-mangadex'
import { OPDSServersSettings } from '@features/manage-opds-servers'
import { TorrentClientSettings } from '@features/manage-torrent-client'
import { ReleaseProfileSettings, TorznabSourcesSettings } from '@features/manage-torznab-sources'
import { LanguageSwitcher } from '@features/switch-language'
import { ThemeSwitcher } from '@features/switch-theme'

import { SECTION_GROUPS } from './sections'
import type { SectionInfo, SettingsSection } from './sections'
import styles from './SettingsPage.module.scss'

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
										navigate({ to: '/settings', search: { section: item.id } })
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
		case 'player':
			return (
				<Card>
					<Row name={t('settings.player.name')} hint={t('settings.player.hint')}>
						<PlayerModeSwitcher />
					</Row>
				</Card>
			)
		case 'torrent-client':
			return (
				<Card>
					<Row name={t('settings.torrents.name')} hint={t('settings.torrents.hint')} block>
						<TorrentClientSettings />
					</Row>
				</Card>
			)
		case 'torrent-search':
			return (
				<Card>
					<Row
						name={t('settings.torrentSearch.name')}
						hint={t('settings.torrentSearch.hint')}
						block
					>
						<TorznabSourcesSettings />
					</Row>
				</Card>
			)
		case 'torrent-preferences':
			return (
				<Card>
					<Row
						name={t('settings.releaseProfile.name')}
						hint={t('settings.releaseProfile.hint')}
						block
					>
						<ReleaseProfileSettings />
					</Row>
				</Card>
			)
		case 'manga-sources':
			return (
				<Card>
					<Row name={t('settings.mangaSources.name')} hint={t('settings.mangaSources.hint')} block>
						<OPDSServersSettings />
					</Row>
				</Card>
			)
		case 'mangadex':
			return (
				<Card>
					<Row name={t('settings.mangaDex.name')} hint={t('settings.mangaDex.hint')} block>
						<MangaDexSettings />
					</Row>
				</Card>
			)
		case 'manga-downloads':
			return (
				<Card>
					<Row name={t('settings.mangaDownloads.name')} hint={t('settings.mangaDownloads.hint')}>
						<DownloadFolderSetting />
					</Row>
				</Card>
			)
	}
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
				<span className={styles.name}>{name}</span>
				<span className={styles.hint}>{hint}</span>
			</div>
			<div className={styles.control}>{children}</div>
		</div>
	)
}
