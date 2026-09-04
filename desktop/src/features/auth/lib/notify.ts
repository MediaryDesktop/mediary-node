import { toast } from '@shared/ui'

import { toAuthMessages } from './failure'

export function notifyProblems(problems: string[]): void {
	for (const problem of problems) {
		toast.error(problem, { id: problem })
	}
}

export function notifyFailure(error: unknown): void {
	notifyProblems(toAuthMessages(error))
}
