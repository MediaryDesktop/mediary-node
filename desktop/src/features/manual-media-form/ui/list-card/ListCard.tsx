import { useTranslation } from '@shared/i18n'
import { Button, Icon, SelectDropdown } from '@shared/ui'
import type { SelectDropdownOption } from '@shared/ui'

import type { TrackerCustomList } from '@entities/tracker'

import { Field } from '../field/Field'
import { SectionCard } from '../section-card/SectionCard'

export interface ListCardProps {
	lists: TrackerCustomList[]
	value: string[]
	onChange: (names: string[]) => void
	onCreateList?: () => void
	disabled?: boolean
}

export function ListCard({ lists, value, onChange, onCreateList, disabled }: ListCardProps) {
	const { t } = useTranslation()

	const options: SelectDropdownOption[] = lists.map(list => ({ value: list.name, label: list.name }))

	return (
		<SectionCard
			icon='common/folder'
			title={t('manualMedia.list.title')}
			subtitle={t('manualMedia.list.hint')}
		>
			{/* A native <label> would implicitly bind to the first tag's remove
			button — the first focusable thing inside it once a list is picked —
			so hovering the field would light that button up instead. */}
			<Field as='div' label={t('manualMedia.list.label')}>
				<SelectDropdown
					mode='multiple'
					options={options}
					value={value}
					onChange={onChange}
					placeholder={t('manualMedia.list.placeholder')}
					clearable
					disabled={disabled}
					accentWhenSelected
					// "+ New list" opens the create-list drawer over this page; the
					// drawer must cover the panel, not sit behind it.
					panelZIndex='calc(var(--layer-overlay) - 1)'
					footer={
						onCreateList && (
							<Button
								size='small'
								variant='ghost'
								fullWidth
								startIcon={<Icon name='common/plus' size={16} />}
								onClick={onCreateList}
							>
								{t('manualMedia.list.create')}
							</Button>
						)
					}
				/>
			</Field>
		</SectionCard>
	)
}
