import type { ButtonHTMLAttributes } from 'react'

import { useRipple } from './useRipple'

export interface RippleButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	disableRipple?: boolean
}

export function RippleButton({
	disableRipple = false,
	disabled,
	type = 'button',
	...props
}: RippleButtonProps) {
	const ripple = useRipple<HTMLButtonElement>({ disabled: disabled || disableRipple })

	return <button {...props} ref={ripple} type={type} disabled={disabled} />
}
