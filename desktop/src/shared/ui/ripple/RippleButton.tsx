import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'

import { mergeRefs } from './merge-refs'
import { useRipple } from './useRipple'

export interface RippleButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	disableRipple?: boolean
}

// forwardRef matters here beyond the usual: Radix's `asChild` clones this
// element and attaches its own ref to wire up the open/close behaviour, which
// silently fails to do anything without one.
export const RippleButton = forwardRef<HTMLButtonElement, RippleButtonProps>(function RippleButton(
	{ disableRipple = false, disabled, type = 'button', ...props },
	forwardedRef
) {
	const ripple = useRipple<HTMLButtonElement>({ disabled: disabled || disableRipple })

	return <button {...props} ref={mergeRefs(ripple, forwardedRef)} type={type} disabled={disabled} />
})
