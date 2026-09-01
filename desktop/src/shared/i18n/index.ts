/**
 * Every user-facing phrase in the renderer.
 *
 * Components read them through `useTranslation`, so they re-render when the
 * language changes; models and validators use `translate` (the instance's `t`)
 * because they run outside React and have no hook to call.
 *
 * Importing this module initialises i18next — `app/main.tsx` does it once,
 * before the first render, and everything else just imports what it needs.
 */
import { i18next } from './instance'

export { useTranslation } from 'react-i18next'

export { LANGUAGES, DEFAULT_LANGUAGE, isLanguage } from './config'
export type { Language } from './config'

export { i18next }

/** `t` outside React: Effector models, validators, error mappers. */
export const translate = i18next.t.bind(i18next)
