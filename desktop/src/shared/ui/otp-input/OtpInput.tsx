import clsx from 'clsx'
import type { ClipboardEvent, KeyboardEvent } from 'react'
import { useEffect, useRef } from 'react'

import styles from './OtpInput.module.scss'

export type OtpInputVariant = 'default' | 'glass'

export interface OtpInputProps {
	variant?: OtpInputVariant
	value: string
	onChange: (code: string) => void
	length?: number
	disabled?: boolean
	invalid?: boolean
	autoFocus?: boolean
	className?: string
	'aria-label'?: string
}

const DIGITS_ONLY = /\D/gu

function write(code: string, index: number, digit: string, length: number): string {
	const cells = Array.from({ length }, (_, cell) => code[cell] ?? '')

	cells[index] = digit

	return cells.join('')
}

export function OtpInput({
	variant = 'default',
	value,
	onChange,
	length = 6,
	disabled = false,
	invalid = false,
	autoFocus = true,
	className,
	'aria-label': ariaLabel
}: OtpInputProps) {
	const cells = useRef<(HTMLInputElement | null)[]>([])

	const valueRef = useRef(value)

	useEffect(() => {
		valueRef.current = value
	}, [value])

	useEffect(() => {
		if (autoFocus) {
			cells.current[0]?.focus({ preventScroll: true })
		}
	}, [autoFocus])

	const focusCell = (index: number) => {
		cells.current[Math.min(Math.max(index, 0), length - 1)]?.focus({ preventScroll: true })
	}

	const handleChange = (index: number, raw: string) => {
		const digit = raw.replace(DIGITS_ONLY, '').slice(-1)
		const next = write(value, index, digit, length)

		valueRef.current = next
		onChange(next)

		if (digit) {
			focusCell(index + 1)
		}
	}

	const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === 'Backspace') {
			event.preventDefault()

			if (value[index]) {
				onChange(write(value, index, '', length))
				return
			}

			const next = write(value, index - 1, '', length)

			valueRef.current = next
			onChange(next)
			focusCell(index - 1)
			return
		}

		if (event.key === 'ArrowLeft') {
			event.preventDefault()
			focusCell(index - 1)
		}

		if (event.key === 'ArrowRight') {
			event.preventDefault()
			focusCell(index + 1)
		}
	}

	const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
		event.preventDefault()

		const pasted = event.clipboardData.getData('text').replace(DIGITS_ONLY, '').slice(0, length)

		if (!pasted) {
			return
		}

		valueRef.current = pasted
		onChange(pasted)
		focusCell(pasted.length)
	}

	return (
		<div
			className={clsx(styles.root, className)}
			role='group'
			aria-label={ariaLabel}
			aria-invalid={invalid ? true : undefined}
		>
			{Array.from({ length }, (_, index) => (
				<input
					key={index}
					ref={cell => {
						cells.current[index] = cell
					}}
					className={clsx(
						styles.cell,
						variant === 'glass' && styles.glass,
						value[index] && styles.filled,
						invalid && styles.invalid
					)}
					type='text'
					inputMode='numeric'
					pattern='\d*'
					maxLength={1}
					autoComplete={index === 0 ? 'one-time-code' : 'off'}
					value={value[index] ?? ''}
					disabled={disabled}
					onChange={event => handleChange(index, event.target.value)}
					onKeyDown={event => handleKeyDown(index, event)}
					onPaste={handlePaste}
					onFocus={event => {
						if (index > valueRef.current.length) {
							focusCell(valueRef.current.length)
							return
						}

						event.target.select()
					}}
				/>
			))}
		</div>
	)
}
