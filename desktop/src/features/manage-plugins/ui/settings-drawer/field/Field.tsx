import { useTranslation } from '@shared/i18n'
import { Button, DrawerSection, Input, SelectDropdown, Switch } from '@shared/ui'

import type { ExtensionSetting } from '@entities/extension'

const DEFAULT_OPTION = '\u0000default'

export interface FieldProps {
	field: ExtensionSetting
	value: string | undefined
	onChange: (value: string) => void
	disabled: boolean
}

export function Field({ field, value, onChange, disabled }: FieldProps) {
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
