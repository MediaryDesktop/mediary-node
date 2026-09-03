import { useCallback, useEffect, useState } from 'react'

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
