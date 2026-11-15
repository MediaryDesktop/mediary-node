import { DatePicker } from '@shared/ui'

import { Field } from '../field/Field'

export interface DatePickerFieldProps {
	label: string
	value: string
	onChange: (value: string) => void
	disabled?: boolean
}

export function DatePickerField({ label, value, onChange, disabled }: DatePickerFieldProps) {
	return (
		<Field as='div' label={label}>
			<DatePicker value={value} onChange={onChange} disabled={disabled} />
		</Field>
	)
}
