import type { Translation } from './en'

export const uk: Translation = {
	language: {
		en: 'English',
		uk: 'Українська',
		ru: 'Русский'
	},

	node: {
		state: {
			stopped: 'Ноду зупинено',
			starting: 'Нода запускається…',
			ready: 'Ноду підключено',
			restarting: 'Нода перезапускається…',
			failed: 'Нода не запустилася'
		}
	},

	input: {
		showPassword: 'Показати пароль',
		hidePassword: 'Сховати пароль'
	},

	auth: {
		pitch: {
			titleLead: 'Твоя',
			titleAccent: 'медіатека',
			tagline:
				'Аніме, манга, дорами, фільми, серіали й книги — один каталог, один прогрес, на всіх пристроях.',
			aside: 'Акаунт потрібен лише для хмарного каталогу й синхронізації. Локальна бібліотека, плеєр і завантаження працюють і без нього.'
		},
		back: 'Повернутися назад',
		signIn: {
			title: 'З поверненням',
			subtitle: 'Увійдіть, щоб продовжити',
			submit: 'Увійти',
			noAccount: 'Немає акаунта?',
			switch: 'Зареєструватися'
		},
		signUp: {
			title: 'Створити акаунт',
			subtitle: 'Кілька полів — і готово',
			submit: 'Зареєструватися',
			haveAccount: 'Вже маєте акаунт?',
			switch: 'Увійти'
		},
		field: {
			name: 'Імʼя',
			email: 'Email',
			password: 'Пароль',
			passwordHint: 'Пароль, щонайменше {{min}} символів',
			confirmation: 'Повторіть пароль'
		},
		validation: {
			emailRequired: 'Вкажіть email',
			emailTooLong: 'Email не довший за {{max}} символів',
			emailInvalid: 'Email виглядає некоректно',
			nameRequired: 'Вкажіть імʼя',
			nameLength: 'Імʼя від {{min}} до {{max}} символів',
			passwordTooShort: 'Пароль щонайменше {{min}} символів',
			passwordTooLong: 'Пароль не довший за {{max}} символів',
			passwordEchoesIdentity: 'Пароль не має повторювати email або імʼя',
			confirmationRequired: 'Повторіть пароль',
			confirmationMismatch: 'Паролі не збігаються'
		},
		error: {
			cloudUnreachable: 'Не вдалося звʼязатися з хмарою',
			requestFailed: 'Не вдалося виконати запит'
		}
	},

	home: {
		subtitle: 'Скелет фази 0. Каталогу ще немає — тут лише перевірка, що оболонка бачить ноду.',
		account: {
			title: 'Хмарний акаунт',
			anonymous: 'Не увійдено — каталог і синхронізація недоступні.',
			signIn: 'Увійти',
			signOut: 'Вийти'
		},
		node: {
			title: 'Локальна нода',
			waiting: 'Очікування на запуск ноди…',
			pending: 'Запит стану…',
			failed: 'Не вдалося опитати ноду: {{error}}',
			version: 'Версія',
			build: 'Збірка',
			linkedLabel: 'Хмарний акаунт',
			linked: 'привʼязано',
			notLinked: 'не привʼязано'
		}
	}
}
