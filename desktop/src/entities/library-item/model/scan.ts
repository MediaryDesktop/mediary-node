import { keepFresh } from '@farfetched/core'
import { createStore } from 'effector'

import { nodeTopic } from '@infra/node'

import { libraryScanHistoryQuery, libraryScanQuery } from './queries'

const libraryScanEvent = nodeTopic('library.scan')

function scanPhase(phase: string) {
	return libraryScanEvent.filter({ fn: event => event.payload?.phase === phase })
}

const scanStarted = scanPhase('started')
const scanProgressed = scanPhase('progress')
const scanRootDone = scanPhase('root')
const scanProbing = scanPhase('probing')
const scanMatching = scanPhase('matching')
export const scanFinished = scanPhase('finished')

keepFresh(libraryScanQuery, { triggers: [scanStarted, scanFinished] })

keepFresh(libraryScanHistoryQuery, { triggers: [scanFinished] })

export type ScanPhase = 'scanning' | 'probing' | 'matching'

export interface ScanActivity {
	phase: ScanPhase

	found: number

	// done and total belong to whichever phase is running: files probed of files
	// to probe, then titles matched of titles to match. One pair rather than a
	// pair per phase, because the bar only ever shows one of them.
	done: number
	total: number

	rootsDone: number
	rootsTotal: number
}

function activityNumber(payload: Record<string, unknown> | undefined, key: string, fallback = 0): number {
	const value = payload?.[key]

	return typeof value === 'number' ? value : fallback
}

// Progress is read off the events rather than refetched: during a scan they
// arrive several times a second, and the node already says everything the
// header needs.
export function createScanActivity() {
	const idle: ScanActivity = {
		phase: 'scanning',
		found: 0,
		done: 0,
		total: 0,
		rootsDone: 0,
		rootsTotal: 0
	}

	return createStore<ScanActivity | null>(null)
		.on(scanStarted, (_, event) => ({
			...idle,
			rootsTotal: activityNumber(event.payload, 'roots_total')
		}))
		.on([scanProgressed, scanRootDone], (current, event) => ({
			...(current ?? idle),
			phase: 'scanning' as const,
			found: activityNumber(event.payload, 'found', current?.found ?? 0),
			done: 0,
			total: 0,
			rootsDone: activityNumber(event.payload, 'roots_done'),
			rootsTotal: activityNumber(event.payload, 'roots_total')
		}))
		.on(scanProbing, (current, event) => ({
			...(current ?? idle),
			phase: 'probing' as const,
			done: activityNumber(event.payload, 'probed'),
			total: activityNumber(event.payload, 'total'),
			rootsDone: activityNumber(event.payload, 'roots_done'),
			rootsTotal: activityNumber(event.payload, 'roots_total')
		}))
		.on(scanMatching, (current, event) => ({
			...(current ?? idle),
			phase: 'matching' as const,
			done: activityNumber(event.payload, 'matched'),
			total: activityNumber(event.payload, 'total'),

			// Matching runs once every folder is walked, so the folder count is
			// complete by definition.
			rootsDone: current?.rootsTotal ?? 0
		}))
		.reset(scanFinished, libraryScanQuery.finished.success)
}
