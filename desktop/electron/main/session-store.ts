import { app, safeStorage } from 'electron'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { StoredSession } from '../shared/session.js'

const FILE_NAME = 'cloud-session.bin'

function file(): string {
	return join(app.getPath('userData'), FILE_NAME)
}

export function canPersistSession(): boolean {
	return safeStorage.isEncryptionAvailable()
}

export async function readStoredSession(): Promise<StoredSession | null> {
	if (!canPersistSession()) {
		return null
	}

	try {
		const encrypted = await readFile(file())
		const decoded: unknown = JSON.parse(safeStorage.decryptString(encrypted))

		if (typeof decoded !== 'object' || decoded === null) {
			return null
		}

		const { token, account } = decoded as Partial<StoredSession>

		return {
			token: typeof token === 'string' && token !== '' ? token : null,
			account: account ?? null
		}
	} catch {
		return null
	}
}

export async function writeStoredSession(session: StoredSession): Promise<void> {
	if (!canPersistSession()) {
		return
	}

	if (session.token === null && session.account === null) {
		await clearStoredSession()
		return
	}

	await writeFile(file(), safeStorage.encryptString(JSON.stringify(session)), { mode: 0o600 })
}

export async function clearStoredSession(): Promise<void> {
	try {
		await rm(file(), { force: true })
	} catch {
		return
	}
}
