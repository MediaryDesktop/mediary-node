import { useUnit } from 'effector-react'
import { useState } from 'react'
import { LuDatabase, LuRefreshCw } from 'react-icons/lu'

import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Button, toast } from '@shared/ui'

import { checkExtensionUpdatesMutation, extensionCatalogQuery } from '@entities/extension'
import { toolsQuery } from '@entities/tool'


export function InstalledActions() {
	const { t } = useTranslation()
	const [check, checking] = useUnit([
		checkExtensionUpdatesMutation.start,
		checkExtensionUpdatesMutation.$pending
	])

	useUnitWatch(checkExtensionUpdatesMutation.finished.success, ({ result }) => {
		const found = (result.extensions ?? []).filter(ext => ext.update?.version && !ext.update.error).length
		toast.success(found ? t('plugins.updatesFound', { count: found }) : t('plugins.noUpdates'), {
			id: 'plugins'
		})
	})

	return (
		<Button loading={checking} startIcon={<LuRefreshCw size={16} />} onClick={() => check()}>
			{t('plugins.checkUpdates')}
		</Button>
	)
}

export function CatalogActions({ onRepositories }: { onRepositories: () => void }) {
	const { t } = useTranslation()
	const [load, pending] = useUnit([extensionCatalogQuery.start, extensionCatalogQuery.$pending])

	return (
		<>
			<Button
				loading={pending}
				startIcon={<LuRefreshCw size={16} />}
				onClick={() => {
					load(true)
					toast.success(t('extensions.refreshed'), { duration: 1000, id: 'plugins' })
				}}
			>
				{t('extensions.refresh')}
			</Button>
			<Button startIcon={<LuDatabase size={16} />} onClick={onRepositories}>
				{t('plugins.repositories.title')}
			</Button>
		</>
	)
}

export function DependenciesActions() {
	const { t } = useTranslation()
	const [refresh] = useUnit([toolsQuery.start])
	const [refreshing, setRefreshing] = useState(false)

	useUnitWatch(toolsQuery.finished.finally, () => setRefreshing(false))

	return (
		<Button
			loading={refreshing}
			startIcon={<LuRefreshCw size={16} />}
			onClick={() => {
				setRefreshing(true)
				refresh()
				toast.success(t('extensions.refreshed'), { duration: 1000 })
			}}
		>
			{t('extensions.refresh')}
		</Button>
	)
}
