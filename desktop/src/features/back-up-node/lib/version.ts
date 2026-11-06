export function isOlderThan(version: string, minimum: string): boolean {
	const a = parts(version)
	const b = parts(minimum)

	if (!a || !b) {
		return false
	}

	for (let i = 0; i < 3; i++) {
		if (a[i]! !== b[i]!) {
			return a[i]! < b[i]!
		}
	}

	return false
}

function parts(version: string): [number, number, number] | null {
	const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version.trim())

	if (!match) {
		return null
	}

	return [Number(match[1]), Number(match[2]), Number(match[3])]
}
