import clsx from 'clsx'
import type { InputHTMLAttributes, ReactNode, Ref } from 'react'
import { useId, useState } from 'react'

import { useTranslation } from '../../i18n'
import { Icon } from '../icon/Icon'

import styles from './Input.module.scss'

export type InputVariant = 'default' | 'glass'

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
	variant?: InputVariant
	type?: 'text' | 'email' | 'password' | 'number' | 'date'
	startIcon?: ReactNode
	revealable?: boolean
	error?: string
	ref?: Ref<HTMLInputElement>
}

export function Input({
	variant = 'default',
	type = 'text',
	startIcon,
	revealable = false,
	error,
	className,
	id,
	...props
}: InputProps) {
	const { t } = useTranslation()
	const [revealed, setRevealed] = useState(false)
	const generatedId = useId()
	const inputId = id ?? generatedId
	const errorId = `${inputId}-error`

	const showToggle = revealable && type === 'password'
	const resolvedType = showToggle && revealed ? 'text' : type

	return (
		<div className={clsx(styles.field, className)}>
			<div className={styles.control}>
				{startIcon && <span className={styles.startIcon}>{startIcon}</span>}

				<input
					{...props}
					id={inputId}
					type={resolvedType}
					aria-invalid={error ? true : undefined}
					aria-describedby={error ? errorId : undefined}
					className={clsx(
						styles.input,
						variant === 'glass' && styles.glass,
						startIcon && styles.withStartIcon,
						showToggle && styles.withEndAction,
						error && styles.invalid
					)}
				/>

				{showToggle && (
					<button
						type='button'
						className={styles.action}
						onMouseDown={event => event.preventDefault()}
						onClick={() => setRevealed(current => !current)}
						aria-label={revealed ? t('input.hidePassword') : t('input.showPassword')}
					>
						<Icon name={revealed ? 'common/eye-off' : 'common/eye'} size={18} />
					</button>
				)}
			</div>

			{error && (
				<p id={errorId} className={styles.error}>
					{error}
				</p>
			)}
		</div>
	)
}
