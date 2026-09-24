import clsx from 'clsx'
import { enUS, ru, uk } from 'date-fns/locale'
import ReactDatePicker, { registerLocale } from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

import { useTranslation } from '../../i18n'
import { Icon } from '../icon/Icon'
import { Input } from '../input/Input'

import styles from './DatePicker.module.scss'

registerLocale('en', enUS)
registerLocale('uk', uk)
registerLocale('ru', ru)

export interface DatePickerProps {
	value: string
	onChange: (value: string) => void
	disabled?: boolean
	placeholder?: string
	className?: string
}

function parseValue(value: string): Date | null {
	const [year, month, day] = value.split('-').map(Number)

	if (!year || !month || !day) {
		return null
	}

	return new Date(year, month - 1, day)
}

function formatValue(date: Date | null): string {
	if (!date) {
		return ''
	}

	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')

	return `${year}-${month}-${day}`
}

export function DatePicker({ value, onChange, disabled, placeholder, className }: DatePickerProps) {
	const { i18n } = useTranslation()

	return (
		<div className={clsx(styles.field, className)}>
			<ReactDatePicker
				selected={parseValue(value)}
				onChange={date => onChange(formatValue(date))}
				disabled={disabled}
				locale={i18n.language}
				dateFormat='dd.MM.yyyy'
				placeholderText={placeholder}
				isClearable={Boolean(value) && !disabled}
				showMonthYearDropdown
				dropdownMode='scroll'
				popperClassName={styles.popper}
				calendarClassName={styles.calendar}
				customInput={<Input readOnly startIcon={<Icon name='common/calendar' size={18} />} />}
			/>
		</div>
	)
}
