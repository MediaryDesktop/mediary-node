// "1:05" or "1:02:05"; a position the player has not reported yet reads as "0:00".
export function formatTimecode(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) {
		return '0:00'
	}

	const whole = Math.floor(seconds)
	const hours = Math.floor(whole / 3600)
	const minutes = Math.floor((whole % 3600) / 60)
	const rest = whole % 60

	const padded = `${minutes.toString().padStart(hours > 0 ? 2 : 1, '0')}:${rest.toString().padStart(2, '0')}`

	return hours > 0 ? `${hours}:${padded}` : padded
}
