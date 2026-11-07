import { createRecordEditor } from '@shared/factory'
import type { MutationLike } from '@shared/factory'

import { OPDS_KINDS } from '../config/kinds'
import type { OPDSKind } from '../config/kinds'
import { bodyOf, canSubmit, checkParamsOf, EMPTY_FIELDS, fieldsOf } from '../lib/form'
import type { CheckParams, EditedServer, ServerBody } from '../lib/form'

export interface CheckOutcome {
	ok: boolean
	problem?: string
}

interface ServerUnits {
	create: MutationLike<ServerBody, unknown>
	update: MutationLike<{ id: number; body: ServerBody }, unknown>
	check: MutationLike<CheckParams, CheckOutcome>
}

export function createServerEditor({ create, update, check }: ServerUnits) {
	return createRecordEditor({
		create,
		update,
		check,
		empty: EMPTY_FIELDS,
		fieldsOf: (server: EditedServer) => fieldsOf(server),
		bodyOf,
		canSubmit,
		checkParamsOf,
		canCheck: fields => fields.url.trim() !== '',
		checkFailed: (): CheckOutcome => ({ ok: false, problem: 'unreachable' })
	})
}

export type ServerEditor = ReturnType<typeof createServerEditor>

export const serverEditors: Record<OPDSKind, ServerEditor> = {
	manga: createServerEditor(OPDS_KINDS.manga),
	books: createServerEditor(OPDS_KINDS.books)
}
