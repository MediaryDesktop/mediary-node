import type { Translation } from './en'

export const ru: Translation = {
	language: {
		en: 'English',
		uk: 'Українська',
		ru: 'Русский'
	},

	node: {
		state: {
			stopped: 'Нода остановлена',
			starting: 'Нода запускается…',
			ready: 'Нода подключена',
			restarting: 'Нода перезапускается…',
			failed: 'Нода не запустилась'
		}
	},

	input: {
		showPassword: 'Показать пароль',
		hidePassword: 'Скрыть пароль'
	},

	auth: {
		pitch: {
			titleLead: 'Твоя',
			titleAccent: 'медиатека',
			tagline:
				'Аниме, манга, дорамы, фильмы, сериалы и книги — один каталог, один прогресс, на всех устройствах.',
			aside: 'Аккаунт нужен только для облачного каталога и синхронизации. Локальная библиотека, плеер и загрузки работают и без него.'
		},
		back: 'Вернуться назад',
		signIn: {
			title: 'С возвращением',
			subtitle: 'Войдите, чтобы продолжить',
			submit: 'Войти',
			noAccount: 'Нет аккаунта?',
			switch: 'Зарегистрироваться'
		},
		signUp: {
			title: 'Создать аккаунт',
			subtitle: 'Несколько полей — и готово',
			submit: 'Зарегистрироваться',
			haveAccount: 'Уже есть аккаунт?',
			switch: 'Войти'
		},
		field: {
			name: 'Имя',
			email: 'Email',
			password: 'Пароль',
			passwordHint: 'Пароль, не менее {{min}} символов',
			confirmation: 'Повторите пароль'
		},
		validation: {
			emailRequired: 'Укажите email',
			emailTooLong: 'Email не длиннее {{max}} символов',
			emailInvalid: 'Email выглядит некорректно',
			nameRequired: 'Укажите имя',
			nameLength: 'Имя от {{min}} до {{max}} символов',
			passwordTooShort: 'Пароль не менее {{min}} символов',
			passwordTooLong: 'Пароль не длиннее {{max}} символов',
			passwordEchoesIdentity: 'Пароль не должен повторять email или имя',
			confirmationRequired: 'Повторите пароль',
			confirmationMismatch: 'Пароли не совпадают'
		},
		error: {
			cloudUnreachable: 'Не удалось связаться с облаком',
			requestFailed: 'Не удалось выполнить запрос'
		}
	},

	home: {
		subtitle: 'Скелет фазы 0. Каталога ещё нет — это лишь проверка, что оболочка видит ноду.',
		account: {
			title: 'Облачный аккаунт',
			anonymous: 'Вход не выполнен — каталог и синхронизация недоступны.',
			signIn: 'Войти',
			signOut: 'Выйти'
		},
		node: {
			title: 'Локальная нода',
			waiting: 'Ожидание запуска ноды…',
			pending: 'Запрос состояния…',
			failed: 'Не удалось опросить ноду: {{error}}',
			version: 'Версия',
			build: 'Сборка',
			linkedLabel: 'Облачный аккаунт',
			linked: 'привязан',
			notLinked: 'не привязан'
		}
	}
}
