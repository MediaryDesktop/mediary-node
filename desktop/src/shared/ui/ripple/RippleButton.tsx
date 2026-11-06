import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'

import { mergeRefs } from './lib/merge-refs'
import { useRipple } from './lib/useRipple'

export interface RippleButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	disableRipple?: boolean
}

export const RippleButton = forwardRef<HTMLButtonElement, RippleButtonProps>(function RippleButton(
	{ disableRipple = false, disabled, type = 'button', ...props },
	forwardedRef
) {
	const ripple = useRipple<HTMLButtonElement>({ disabled: disabled || disableRipple })

	return <button {...props} ref={mergeRefs(ripple, forwardedRef)} type={type} disabled={disabled} />
})
