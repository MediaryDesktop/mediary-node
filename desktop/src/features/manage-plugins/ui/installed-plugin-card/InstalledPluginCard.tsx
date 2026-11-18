import { useUnit } from 'effector-react'
import { useState } from 'react'
import { LuEllipsisVertical, LuRefreshCw, LuSettings2 } from 'react-icons/lu'
import { TbBraces, TbBracesOff } from 'react-icons/tb'

import { useTranslation } from '@shared/i18n'
import { Button, DropdownMenu, ItemCard, ItemCardAction, Modal } from '@shared/ui'
import type { DropdownMenuItem } from '@shared/ui'

import { configureExtensionMutation, removeExtensionMutation } from '@entities/extension'
import type { Extension } from '@entities/extension'

import { languageName } from '../../lib/languages'
import { PluginIcon } from '../plugin-icon/PluginIcon'

import { Hosts } from './hosts/Hosts'
import styles from './InstalledPluginCard.module.scss'

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
					icon: <TbBracesOff size={20} />,
					onSelect: () => configure({ id: extension.id, enabled: false })
				}
			: {
					id: 'enable',
					label: t('plugins.enable'),
					icon: <TbBraces size={20} />,
					onSelect: () => configure({ id: extension.id, enabled: true })
				},
		{
			id: 'remove',
			label: t('plugins.remove'),
			icon: 'common/trash',
			danger: true,
			onSelect: () => setConfirming(true)
		}
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
