// Compares "1.4.0"-style versions, a leading "v" and any "-dev"/"+build" tail
// ignored. Only what the cloud's min_supported needs: a build is older or not.
export function isOlderThan(version: string, minimum: string): boolean {
	const a = parts(version)
	const b = parts(minimum)

	if (!a || !b) {
		// An unreadable version is not a reason to switch backups off.
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
