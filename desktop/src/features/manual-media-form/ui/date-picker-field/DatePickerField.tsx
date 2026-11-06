import { DatePicker } from '@shared/ui'

import { Field } from '../field/Field'

export interface DatePickerFieldProps {
	label: string
	value: string
	onChange: (value: string) => void
	ai?: boolean
	disabled?: boolean
}

export function DatePickerField({ label, value, onChange, ai, disabled }: DatePickerFieldProps) {
	return (
		<Field as='div' label={label} ai={ai}>
			<DatePicker value={value} onChange={onChange} disabled={disabled} />
		</Field>
	)
}
