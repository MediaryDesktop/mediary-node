import { useUnit } from 'effector-react'
import { useState } from 'react'
import { LuDownload, LuEllipsisVertical, LuRefreshCw, LuSettings2 } from 'react-icons/lu'

import { useTranslation } from '@shared/i18n'
import { Button, DropdownMenu, Icon, ItemCard, ItemCardAction, ItemCardMark, Modal } from '@shared/ui'
import type { DropdownMenuItem } from '@shared/ui'

import { configureExtensionMutation, removeExtensionMutation } from '@entities/extension'
import type { CatalogPlugin, Extension } from '@entities/extension'

import { languageName } from '../../lib/languages'

import styles from './PluginCard.module.scss'

// The plugin's own icon from its manifest, or its first letter when there is
// none or it does not load.
function PluginIcon({ name, icon }: { name: string; icon?: string }) {
	const [broken, setBroken] = useState(false)

	if (icon && !broken) {
		return <img src={icon} alt='' referrerPolicy='no-referrer' onError={() => setBroken(true)} />
	}

	return <span className={styles.letter}>{name.slice(0, 1).toUpperCase()}</span>
}

function Hosts({ hosts }: { hosts: string[] }) {
	const { t } = useTranslation()

	return (
		<p className={styles.hosts} title={hosts.join(', ')}>
			{hosts.length > 0 ? t('plugins.hosts', { hosts: hosts.join(', ') }) : t('plugins.noHosts')}
		</p>
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
			<ItemCard
				icon={<PluginIcon name={extension.name} icon={extension.icon} />}
				title={extension.name}
				subtitle={extension.id}
				description={extension.description}
				muted={!extension.enabled}
				highlight={hasUpdate ? 'success' : undefined}
				meta={[
					hasUpdate ? `${extension.version} → ${update?.version}` : extension.version,
					extension.author,
					languageName(extension.lang, t('plugins.multiLanguage')),
					!extension.enabled && <span className={styles.off}>{t('plugins.disabled')}</span>,
					update?.error && (
						<span className={styles.warning} title={update.error}>
							{t('plugins.updateCheckFailed')}
						</span>
					)
				]}
				actions={
					<>
						{hasUpdate && (
							<ItemCardAction
								label={t('plugins.update', { version: update?.version ?? '' })}
								tone='success'
								onClick={() => onUpdate(extension)}
							>
								<LuRefreshCw size={16} />
							</ItemCardAction>
						)}
						{(extension.config ?? []).length > 0 && (
							<ItemCardAction
								label={t('plugins.settings')}
								onClick={() => onSettings(extension)}
							>
								<LuSettings2 size={16} />
							</ItemCardAction>
						)}
						<DropdownMenu
							align='end'
							items={menu}
							trigger={
								<ItemCardAction label={t('plugins.more')} tooltip={false}>
									<LuEllipsisVertical size={16} />
								</ItemCardAction>
							}
						/>
					</>
				}
			>
				<Hosts hosts={extension.network ?? []} />
			</ItemCard>

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

	const action = () => {
		if (plugin.update) {
			return (
				<ItemCardAction
					label={t('plugins.update', { version: plugin.version })}
					tone='success'
					onClick={() => onUpdate(plugin.id)}
				>
					<LuRefreshCw size={16} />
				</ItemCardAction>
			)
		}

		if (plugin.installed) {
			return (
				<ItemCardMark
					label={
						plugin.installed_here ? t('plugins.installedHere') : t('plugins.installedElsewhere')
					}
				>
					<Icon name='common/check' size={16} />
				</ItemCardMark>
			)
		}

		return (
			<ItemCardAction
				label={t('plugins.install')}
				tone='primary'
				onClick={() => onInstall(plugin.manifest_url)}
			>
				<LuDownload size={16} />
			</ItemCardAction>
		)
	}

	return (
		<ItemCard
			icon={<PluginIcon name={plugin.name} icon={plugin.icon} />}
			title={plugin.name}
			subtitle={plugin.id}
			description={plugin.description}
			highlight={plugin.update ? 'success' : undefined}
			meta={[
				plugin.version,
				plugin.author,
				languageName(plugin.lang, t('plugins.multiLanguage')),
				t('plugins.from', { repository: plugin.repository_name })
			]}
			actions={action()}
		/>
	)
}
