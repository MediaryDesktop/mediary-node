import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'

import { DEFAULT_LANGUAGE, isLanguage, readStoredLanguage, storeLanguage } from './config'
import { en } from './locales/en'
import { ru } from './locales/ru'
import { uk } from './locales/uk'

void i18next.use(initReactI18next).init({
	resources: {
		en: { translation: en },
		uk: { translation: uk },
		ru: { translation: ru }
	},
	lng: readStoredLanguage() ?? DEFAULT_LANGUAGE,
	fallbackLng: DEFAULT_LANGUAGE,

	defaultNS: 'translation',

	nsSeparator: false,
	interpolation: {
		escapeValue: false
	}
})

function remember(language: string): void {
	if (!isLanguage(language)) {
		return
	}

	storeLanguage(language)

	document.documentElement.lang = language
}

i18next.on('languageChanged', remember)

remember(i18next.language)

export { i18next }
