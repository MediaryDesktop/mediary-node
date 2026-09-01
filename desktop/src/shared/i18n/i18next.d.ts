import 'i18next'

import type { en } from './locales/en'

/**
 * Makes `t` typed: unknown keys and missing interpolation values become
 * compile errors, and the editor completes key paths from `en.ts`.
 */
declare module 'i18next' {
	interface CustomTypeOptions {
		defaultNS: 'translation'
		nsSeparator: false
		resources: {
			translation: typeof en
		}
	}
}
