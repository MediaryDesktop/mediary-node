import '@fontsource/montserrat/400.css'
import '@fontsource/montserrat/500.css'
import '@fontsource/montserrat/600.css'
import '@fontsource/montserrat/700.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@shared/i18n'
import '@shared/style/main.scss'
import '@shared/style/theme'

import { App } from './App'

const container = document.getElementById('root')

if (!container) {
	throw new Error('#root is missing from index.html')
}

createRoot(container).render(
	<StrictMode>
		<App />
	</StrictMode>
)
