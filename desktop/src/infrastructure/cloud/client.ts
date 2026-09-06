import { createRequestFx } from '@shared/api'

const CLOUD_BASE_URL = import.meta.env.VITE_CLOUD_URL ?? 'http://127.0.0.1:8080'

let token: string | null = null

export function setCloudToken(next: string | null): void {
	token = next
}

export function hasCloudToken(): boolean {
	return token !== null
}

export const createCloudRequestFx = createRequestFx({
	baseURL: CLOUD_BASE_URL,
	headers: (): HeadersInit => (token ? { Authorization: `Bearer ${token}` } : {})
})
