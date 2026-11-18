import { useEffect, useState } from 'react'

export interface OtpCountdown {
	known: boolean
	secondsLeft: number
	expired: boolean
	formatted: string
}

function remaining(deadline: number): number {
	return Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
}

function format(totalSeconds: number): string {
	const minutes = Math.floor(totalSeconds / 60)
	const seconds = totalSeconds % 60

	return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function useOtpCountdown(expiresAt: string | null): OtpCountdown {
	const parsed = expiresAt === null ? Number.NaN : Date.parse(expiresAt)
	const known = Number.isFinite(parsed)

	const [, tick] = useState(0)

	useEffect(() => {
		if (!known) {
			return
		}

		const timer = setInterval(() => tick(previous => previous + 1), 1000)

		return () => clearInterval(timer)
	}, [known, parsed])

	const secondsLeft = known ? remaining(parsed) : 0

	return {
		known,
		secondsLeft,
		expired: known && secondsLeft === 0,
		formatted: format(secondsLeft)
	}
}
