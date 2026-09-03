import { i18next } from './instance'

export { useTranslation } from 'react-i18next'

export { LANGUAGES } from './config'

export const translate = i18next.t.bind(i18next)
