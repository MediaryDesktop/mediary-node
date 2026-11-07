import clsx from 'clsx'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { LuCheck, LuGlobe, LuShieldCheck, LuSlidersHorizontal, LuTag, LuX } from 'react-icons/lu'

import { useTranslation } from '@shared/i18n'
import { Notice } from '@shared/ui'

import type { ExtensionPreview } from '@entities/extension'

import { languageName } from '../../../lib/languages'

import styles from './Consent.module.scss'

interface ConsentProps {
	preview: ExtensionPreview
	before: string[] | null
	alreadyInstalled: boolean
}

export function Consent({ preview: p, before, alreadyInstalled }: ConsentProps) {
	const { t } = useTranslation()
	const [broken, setBroken] = useState(false)

	const hosts = p.network ?? []
	const settings = p.config ?? []
	const manga = p.type === 'manga-provider'

	return (
		<div className={styles.consent}>
			<div className={styles.plugin}>
				<span className={styles.icon}>
					{p.icon && !broken ? (
						<img
							src={p.icon}
							alt=''
							referrerPolicy='no-referrer'
							onError={() => setBroken(true)}
						/>
					) : (
						p.name.slice(0, 1).toUpperCase()
					)}
				</span>
				<div className={styles.titles}>
					<p className={styles.name}>{p.name}</p>
					<p className={styles.byline}>
						{[`v${p.version}`, p.author, languageName(p.lang, t('plugins.multiLanguage'))]
							.filter(Boolean)
							.join(' · ')}
					</p>
				</div>
			</div>

			{p.description && <p className={styles.description}>{p.description}</p>}

			<ul className={styles.facts}>
				<Fact
					icon={<LuGlobe size={18} />}
					tone='info'
					title={
						hosts.length > 0
							? t('plugins.dialog.hosts', { count: hosts.length })
							: t('plugins.dialog.hostsNone')
					}
				>
					{hosts.length > 0 ? (
						<ul className={styles.chips}>
							{hosts.map(host => {
								const added = before !== null && !before.includes(host)

								return (
									<li key={host} className={clsx(styles.host, added && styles.added)}>
										{host}
										{added && (
											<span className={styles.tag}>{t('plugins.dialog.hostsNew')}</span>
										)}
									</li>
								)
							})}
						</ul>
					) : (
						<p className={styles.text}>{t('plugins.dialog.hostsNoneHint')}</p>
					)}
				</Fact>

				<Fact icon={<LuTag size={18} />} tone='warning' title={t('plugins.dialog.receivesTitle')}>
					<p className={styles.text}>
						{manga ? t('plugins.dialog.receivesManga') : t('plugins.dialog.receives')}
					</p>
					<p className={styles.private}>
						<LuCheck size={14} />
						{t('plugins.dialog.receivesPrivate')}
					</p>
				</Fact>

				{settings.length > 0 && (
					<Fact
						icon={<LuSlidersHorizontal size={18} />}
						tone='purple'
						title={t('plugins.dialog.settings', { count: settings.length })}
					>
						<ul className={styles.chips}>
							{settings.map(field => (
								<li key={field.name} className={styles.setting}>
									{field.label}
									{field.secret && (
										<span className={styles.tag}>{t('plugins.dialog.secret')}</span>
									)}
								</li>
							))}
						</ul>
					</Fact>
				)}
			</ul>

			<div className={styles.sandbox}>
				<p className={styles.sandboxTitle}>
					<LuShieldCheck size={18} />
					{t('plugins.dialog.sandboxTitle')}
				</p>
				<ul className={styles.sandboxList}>
					{(
						[
							'plugins.dialog.sandboxFiles',
							'plugins.dialog.sandboxSites',
							'plugins.dialog.sandboxPrograms',
							'plugins.dialog.sandboxNetwork'
						] as const
					).map(key => (
						<li key={key}>
							<LuX size={13} />
							{t(key)}
						</li>
					))}
				</ul>
				<p className={styles.sandboxNote}>
					{manga ? t('plugins.dialog.sandboxNoteManga') : t('plugins.dialog.sandboxNote')}
				</p>
			</div>

			{!p.compatible && (
				<Notice tone='warning'>
					{t('plugins.dialog.incompatible', { version: p.min_node_version ?? '' })}
				</Notice>
			)}
			{alreadyInstalled && (
				<Notice tone='info'>
					{t('plugins.dialog.alreadyInstalled', { version: p.installed ?? '' })}
				</Notice>
			)}
		</div>
	)
}

interface FactProps {
	icon: ReactNode
	tone: 'info' | 'warning' | 'purple'
	title: string
	children: ReactNode
}

function Fact({ icon, tone, title, children }: FactProps) {
	return (
		<li className={styles.fact}>
			<span className={clsx(styles.factIcon, styles[tone])}>{icon}</span>
			<div className={styles.factBody}>
				<p className={styles.factTitle}>{title}</p>
				{children}
			</div>
		</li>
	)
}
