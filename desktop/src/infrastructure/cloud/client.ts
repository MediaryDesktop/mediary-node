import { createRequestFx } from '@shared/api'

const CLOUD_BASE_URL = import.meta.env.VITE_CLOUD_URL ?? 'http://127.0.0.1:8080'

let sessionId: string | null = null

export function setCloudSession(id: string | null): void {
	sessionId = id
}

export function hasCloudSession(): boolean {
	return sessionId !== null
}

export const createCloudRequestFx = createRequestFx({
	baseURL: CLOUD_BASE_URL,
	headers: (): HeadersInit => (sessionId ? { Authorization: `Bearer ${sessionId}` } : {})
})
