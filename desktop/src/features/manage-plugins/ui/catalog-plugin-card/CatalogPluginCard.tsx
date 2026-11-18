import { LuDownload, LuRefreshCw } from 'react-icons/lu'

import { useTranslation } from '@shared/i18n'
import { Icon, ItemCard, ItemCardAction, ItemCardMark } from '@shared/ui'

import type { CatalogPlugin } from '@entities/extension'

import { languageName } from '../../lib/languages'
import { PluginIcon } from '../plugin-icon/PluginIcon'

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
