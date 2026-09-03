import { i18next } from './instance'

export { useTranslation } from 'react-i18next'

export { LANGUAGES, DEFAULT_LANGUAGE, isLanguage } from './config'
export type { Language } from './config'

export { i18next }

export const translate = i18next.t.bind(i18next)
