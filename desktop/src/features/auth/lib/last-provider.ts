import { readStored, writeStored } from '@shared/lib'

const STORAGE_KEY = 'mediary.lastAuthProvider'

export function readLastProvider(): string | null {
	return readStored(STORAGE_KEY)
}

export function storeLastProvider(provider: string): void {
	writeStored(STORAGE_KEY, provider)
}
