import { useUnit } from 'effector-react'
import { useState } from 'react'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Button, Drawer, DrawerForm, DrawerSection, Input, SelectDropdown, Switch, toast } from '@shared/ui'

import { configureExtensionMutation } from '@entities/extension'
import type { Extension, ExtensionSetting } from '@entities/extension'

export interface PluginSettingsDrawerProps {
	extension: Extension | null
	onClose: () => void
}

// Mounted afresh for every opening, so the fields start from what is saved.
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

	// Only what the user touched is sent: a secret left alone stays as saved.
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

interface FieldProps {
	field: ExtensionSetting
	// The value typed, or undefined while the field is as saved.
	value: string | undefined
	onChange: (value: string) => void
	disabled: boolean
}

// The select's own value for "default": it reads an empty value as nothing chosen.
const DEFAULT_OPTION = '\u0000default'

function Field({ field, value, onChange, disabled }: FieldProps) {
	const { t } = useTranslation()

	const current = value ?? field.value ?? ''
	const effective = current || field.default || ''

	switch (field.type) {
		case 'select':
			return (
				<DrawerSection title={field.label}>
					<SelectDropdown
						options={[
							{
								value: DEFAULT_OPTION,
								label: t('plugins.settingsDrawer.default', { value: field.default ?? '—' })
							},
							...(field.options ?? []).map(option => ({ value: option, label: option }))
						]}
						value={current || DEFAULT_OPTION}
						onChange={next => onChange(!next || next === DEFAULT_OPTION ? '' : next)}
						disabled={disabled}
					/>
				</DrawerSection>
			)

		case 'switch':
			return (
				<DrawerSection>
					<Switch
						label={field.label}
						checked={effective === 'true'}
						onChange={checked => onChange(checked ? 'true' : 'false')}
						disabled={disabled}
					/>
				</DrawerSection>
			)

		default:
			if (field.secret) {
				const cleared = value === ''
				return (
					<DrawerSection
						title={field.label}
						description={
							field.set && !cleared ? t('plugins.settingsDrawer.secretSet') : undefined
						}
						action={
							field.set &&
							!cleared && (
								<Button
									size='small'
									variant='ghost'
									onClick={() => onChange('')}
									disabled={disabled}
								>
									{t('plugins.settingsDrawer.secretClear')}
								</Button>
							)
						}
					>
						<Input
							type='password'
							revealable
							value={value ?? ''}
							onChange={event => onChange(event.target.value)}
							disabled={disabled}
							autoComplete='off'
							spellCheck={false}
						/>
					</DrawerSection>
				)
			}

			return (
				<DrawerSection title={field.label}>
					<Input
						value={current}
						placeholder={field.default}
						onChange={event => onChange(event.target.value)}
						disabled={disabled}
						spellCheck={false}
					/>
				</DrawerSection>
			)
	}
}
