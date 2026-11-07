import type { RequestFailure } from '@shared/api'
import { createRecordEditor } from '@shared/factory'

import {
	checkTorrentSourceMutation,
	createTorrentSourceMutation,
	updateTorrentSourceMutation
} from '@entities/torrent'
import type { TorrentSourceCaps } from '@entities/torrent'

import { bodyOf, canSubmit, checkParamsOf, EMPTY_FIELDS, fieldsOf } from '../lib/form'

export type SourceCheck = ({ ok: true } & TorrentSourceCaps) | { ok: false; error: RequestFailure['error'] }

export const sourceEditor = createRecordEditor({
	create: createTorrentSourceMutation,
	update: updateTorrentSourceMutation,
	check: checkTorrentSourceMutation,
	empty: EMPTY_FIELDS,
	fieldsOf,
	bodyOf,
	canSubmit,
	checkParamsOf,
	canCheck: fields => fields.url.trim() !== '',
	checkSucceeded: (caps): SourceCheck => ({ ok: true, ...caps }),
	checkFailed: (error): SourceCheck => ({ ok: false, error })
})
