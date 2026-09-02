import { useCallback, useEffect, useState } from 'react'

/**
 * How long the code in the user's inbox is still worth typing.
 *
 * The deadline is the server's, not ours: this only counts down to it so a form
 * can say "expired" before the user spends an attempt on a code that is already
 * gone. `restart` is for the resend button, which asks for a new one.
 *
 * It counts to a timestamp rather than decrementing a number, because an
 * Electron window that was minimised for ten minutes had its timers throttled
 * and would otherwise come back believing the code is still fresh.
 */

export interface OtpCountdown {
	secondsLeft: number
	expired: boolean
	formatted: string
	restart: () => void
}

function format(totalSeconds: number): string {
	const minutes = Math.floor(totalSeconds / 60)
	const seconds = totalSeconds % 60

	return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function useOtpCountdown(ttlSeconds: number): OtpCountdown {
	const [deadline, setDeadline] = useState(() => Date.now() + ttlSeconds * 1000)
	const [secondsLeft, setSecondsLeft] = useState(ttlSeconds)

	useEffect(() => {
		const timer = setInterval(() => {
			const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))

			setSecondsLeft(left)

			if (left === 0) {
				clearInterval(timer)
			}
		}, 1000)

		return () => clearInterval(timer)
	}, [deadline])

	const restart = useCallback(() => {
		setDeadline(Date.now() + ttlSeconds * 1000)
		setSecondsLeft(ttlSeconds)
	}, [ttlSeconds])

	return {
		secondsLeft,
		expired: secondsLeft === 0,
		formatted: format(secondsLeft),
		restart
	}
}
