import { i18next } from './instance'

export { useTranslation } from 'react-i18next'

export { DEFAULT_LANGUAGE, isLanguage, LANGUAGES } from './config'

export const translate = i18next.t.bind(i18next)
