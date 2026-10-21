import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { LuCheck, LuDownload, LuEllipsisVertical, LuRefreshCw, LuSettings2 } from 'react-icons/lu'

import { useTranslation } from '@shared/i18n'
import { Button, DropdownMenu, Modal, RippleButton, Tooltip } from '@shared/ui'
import type { DropdownMenuItem } from '@shared/ui'

import { configureExtensionMutation, removeExtensionMutation } from '@entities/extension'
import type { CatalogPlugin, Extension } from '@entities/extension'

import { languageName } from '../../lib/languages'

import styles from './PluginCard.module.scss'

interface FrameProps {
	name: string
	id: string
	icon?: string
	description?: string
	meta: ReactNode[]
	hosts?: string[]
	corner: ReactNode
	muted?: boolean
	update?: boolean
}

// The card both lists share, laid out like Seanime's extension card: icon,
// name and id, what it does, a line of facts, the actions in the corner.
function Frame({ name, id, icon, description, meta, hosts, corner, muted, update }: FrameProps) {
	const { t } = useTranslation()
	const [broken, setBroken] = useState(false)

	return (
		<article className={clsx(styles.card, muted && styles.muted, update && styles.update)}>
			<div className={styles.corner}>{corner}</div>

			<div className={styles.head}>
				<span className={styles.icon}>
					{icon && !broken ? (
						<img src={icon} alt='' referrerPolicy='no-referrer' onError={() => setBroken(true)} />
					) : (
						<span className={styles.letter}>{name.slice(0, 1).toUpperCase()}</span>
					)}
				</span>

				<div className={styles.titles}>
					<p className={styles.name}>{name}</p>
					<p className={styles.id}>{id}</p>
				</div>
			</div>

			{description && <p className={styles.description}>{description}</p>}

			{hosts && (
				<p className={styles.hosts} title={hosts.join(', ')}>
					{hosts.length > 0
						? t('plugins.hosts', { hosts: hosts.join(', ') })
						: t('plugins.noHosts')}
				</p>
			)}

			<div className={styles.meta}>
				{meta.filter(Boolean).map((item, index) => (
					<span key={index}>{item}</span>
				))}
			</div>
		</article>
	)
}

function CornerButton({
	label,
	tone = 'default',
	disabled,
	onClick,
	children
}: {
	label: string
	tone?: 'default' | 'primary' | 'success' | 'done'
	disabled?: boolean
	onClick?: () => void
	children: ReactNode
}) {
	return (
		<Tooltip content={label} side='left'>
			<RippleButton
				className={clsx(styles.cornerButton, styles[tone])}
				aria-label={label}
				disabled={disabled}
				onClick={onClick}
			>
				{children}
			</RippleButton>
		</Tooltip>
	)
}

export interface InstalledPluginCardProps {
	extension: Extension
	onUpdate: (extension: Extension) => void
	onSettings: (extension: Extension) => void
}

export function InstalledPluginCard({ extension, onUpdate, onSettings }: InstalledPluginCardProps) {
	const { t } = useTranslation()
	const [configure, remove, removing] = useUnit([
		configureExtensionMutation.start,
		removeExtensionMutation.start,
		removeExtensionMutation.$pending
	])
	const [confirming, setConfirming] = useState(false)

	const update = extension.update
	const hasUpdate = Boolean(update?.version) && !update?.error

	const menu: DropdownMenuItem[] = [
		extension.enabled
			? {
					id: 'disable',
					label: t('plugins.disable'),
					onSelect: () => configure({ id: extension.id, enabled: false })
				}
			: {
					id: 'enable',
					label: t('plugins.enable'),
					onSelect: () => configure({ id: extension.id, enabled: true })
				},
		{ id: 'remove', label: t('plugins.remove'), danger: true, onSelect: () => setConfirming(true) }
	]

	return (
		<>
			<Frame
				name={extension.name}
				id={extension.id}
				icon={extension.icon}
				description={extension.description}
				hosts={extension.network ?? []}
				muted={!extension.enabled}
				update={hasUpdate}
				meta={[
					hasUpdate ? `${extension.version} → ${update?.version}` : extension.version,
					extension.author,
					languageName(extension.lang, t('plugins.multiLanguage')),
					!extension.enabled && (
						<span key='off' className={styles.off}>
							{t('plugins.disabled')}
						</span>
					),
					update?.error && (
						<span key='update' className={styles.warning} title={update.error}>
							{t('plugins.updateCheckFailed')}
						</span>
					)
				]}
				corner={
					<>
						{hasUpdate && (
							<CornerButton
								label={t('plugins.update', { version: update?.version ?? '' })}
								tone='success'
								onClick={() => onUpdate(extension)}
							>
								<LuRefreshCw size={16} />
							</CornerButton>
						)}
						{(extension.config ?? []).length > 0 && (
							<CornerButton label={t('plugins.settings')} onClick={() => onSettings(extension)}>
								<LuSettings2 size={16} />
							</CornerButton>
						)}
						<DropdownMenu
							align='end'
							items={menu}
							trigger={
								<RippleButton className={styles.cornerButton} aria-label={t('plugins.more')}>
									<LuEllipsisVertical size={16} />
								</RippleButton>
							}
						/>
					</>
				}
			/>

			<Modal
				open={confirming}
				onOpenChange={setConfirming}
				size='sm'
				title={t('plugins.removeConfirm.title', { name: extension.name })}
				description={t('plugins.removeConfirm.description')}
				footer={
					<>
						<Button onClick={() => setConfirming(false)}>{t('plugins.dialog.cancel')}</Button>
						<Button
							variant='primary'
							loading={removing}
							onClick={() => {
								remove(extension.id)
								setConfirming(false)
							}}
						>
							{t('plugins.removeConfirm.confirm')}
						</Button>
					</>
				}
			/>
		</>
	)
}

export interface CatalogPluginCardProps {
	plugin: CatalogPlugin
	onInstall: (manifestUrl: string) => void
	onUpdate: (id: string) => void
}

export function CatalogPluginCard({ plugin, onInstall, onUpdate }: CatalogPluginCardProps) {
	const { t } = useTranslation()

	const corner = () => {
		if (plugin.update) {
			return (
				<CornerButton
					label={t('plugins.update', { version: plugin.version })}
					tone='success'
					onClick={() => onUpdate(plugin.id)}
				>
					<LuRefreshCw size={16} />
				</CornerButton>
			)
		}

		if (plugin.installed) {
			return (
				<CornerButton
					label={
						plugin.installed_here ? t('plugins.installedHere') : t('plugins.installedElsewhere')
					}
					tone='done'
				>
					<LuCheck size={16} />
				</CornerButton>
			)
		}

		return (
			<CornerButton
				label={t('plugins.install')}
				tone='primary'
				onClick={() => onInstall(plugin.manifest_url)}
			>
				<LuDownload size={16} />
			</CornerButton>
		)
	}

	return (
		<Frame
			name={plugin.name}
			id={plugin.id}
			icon={plugin.icon}
			description={plugin.description}
			update={plugin.update}
			meta={[
				plugin.version,
				plugin.author,
				languageName(plugin.lang, t('plugins.multiLanguage')),
				<span key='source' className={styles.source}>
					{t('plugins.from', { repository: plugin.repository_name })}
				</span>
			]}
			corner={corner()}
		/>
	)
}
