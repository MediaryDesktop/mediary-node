import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@shared/i18n'
import '@shared/ui/theme/global.scss'

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
