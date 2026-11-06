import { useCallback, useEffect } from 'react'
import type { RefObject } from 'react'

import type { BookViewHandle } from '../types'

export interface BookKeyboardOptions {
	viewRef: RefObject<BookViewHandle | null>
	tocOpen: boolean
	onCloseToc: () => void
	onClose: () => void
}

export function useBookKeyboard({ viewRef, tocOpen, onCloseToc, onClose }: BookKeyboardOptions) {
	const onKey = useCallback(
		(event: KeyboardEvent) => {
			if (event.ctrlKey || event.metaKey || event.altKey) {
				return
			}

			switch (event.key) {
				case 'ArrowRight':
				case 'PageDown':
				case ' ':
					viewRef.current?.next()
					break
				case 'ArrowLeft':
				case 'PageUp':
					viewRef.current?.prev()
					break
				case 'Escape':
					if (tocOpen) {
						onCloseToc()
					} else {
						onClose()
					}
					break
				default:
					return
			}

			event.preventDefault()
		},
		[viewRef, tocOpen, onCloseToc, onClose]
	)

	useEffect(() => {
		window.addEventListener('keydown', onKey)

		return () => window.removeEventListener('keydown', onKey)
	}, [onKey])

	return onKey
}
