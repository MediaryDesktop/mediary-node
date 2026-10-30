import { DatePicker } from '@shared/ui'

import { Field } from '../field/Field'

export interface DatePickerFieldProps {
	label: string
	value: string
	onChange: (value: string) => void
	ai?: boolean
	disabled?: boolean
}

// The month and day behind a count that otherwise only knows its year — kept
// apart from Year itself, which the identity card always shows on its own.
// DatePicker's own clear button already empties this back out.
export function DatePickerField({ label, value, onChange, ai, disabled }: DatePickerFieldProps) {
	return (
		<Field as='div' label={label} ai={ai}>
			<DatePicker value={value} onChange={onChange} disabled={disabled} />
		</Field>
	)
}
