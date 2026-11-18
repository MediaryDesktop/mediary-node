import { useUnit } from 'effector-react'
import { useState } from 'react'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Drawer, DrawerForm, toast } from '@shared/ui'

import { configureExtensionMutation } from '@entities/extension'
import type { Extension } from '@entities/extension'

import { Field } from './field/Field'

export interface PluginSettingsDrawerProps {
	extension: Extension | null
	onClose: () => void
}

export function PluginSettingsDrawer({ extension, onClose }: PluginSettingsDrawerProps) {
	const { t } = useTranslation()

	return (
		<Drawer
			open={extension !== null}
			onOpenChange={open => !open && onClose()}
			title={extension ? t('plugins.settingsDrawer.title', { name: extension.name }) : ''}
			description={t('plugins.settingsDrawer.description')}
			closable={false}
		>
			{extension && <SettingsForm extension={extension} onDone={onClose} />}
		</Drawer>
	)
}

function SettingsForm({ extension, onDone }: { extension: Extension; onDone: () => void }) {
	const { t } = useTranslation()
	const [save, saving] = useUnit([configureExtensionMutation.start, configureExtensionMutation.$pending])

	const fields = extension.config ?? []

	const [changes, setChanges] = useState<Record<string, string>>({})
	const change = (name: string, value: string) => setChanges(current => ({ ...current, [name]: value }))

	useUnitWatch(configureExtensionMutation.finished.success, () => {
		toast.success(t('plugins.settingsDrawer.saved'), { id: 'plugins' })
		onDone()
	})
	useUnitWatch(configureExtensionMutation.finished.failure, ({ error }) =>
		toast.error(problemDetail(error, t('plugins.actionFailed')), { id: 'plugins' })
	)

	return (
		<DrawerForm
			onSubmit={() => save({ id: extension.id, config: changes })}
			onCancel={onDone}
			submitLabel={t('plugins.settingsDrawer.save')}
			submitDisabled={saving || Object.keys(changes).length === 0}
			cancelDisabled={saving}
			submitting={saving}
		>
			{fields.map(field => (
				<Field
					key={field.name}
					field={field}
					value={changes[field.name]}
					onChange={value => change(field.name, value)}
					disabled={saving}
				/>
			))}
		</DrawerForm>
	)
}
