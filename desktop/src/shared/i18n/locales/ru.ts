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
		or: 'или',
		otherWay: 'Другой способ входа',
		providers: {
			label: 'Продолжить через',
			lastUsed: 'В прошлый раз',
			failed: 'Не удалось войти через {{provider}}. Попробуйте ещё раз.'
		},
		signIn: {
			eyebrow: 'С возвращением',
			title: 'Привет!',
			subtitle: 'Выберите, как вам удобнее войти.',
			emailTitle: 'Вход',
			emailSubtitle: 'Войдите, чтобы продолжить с того же места.',
			submit: 'Войти',
			useEmail: 'Войти через почту и пароль',
			forgotPassword: 'Забыли пароль?',
			noAccount: 'Нет аккаунта?',
			switch: 'Зарегистрироваться'
		},
		signUp: {
			eyebrow: 'Присоединяйтесь',
			title: 'Создать аккаунт',
			subtitle: 'Выберите, как вам удобнее зарегистрироваться.',
			emailTitle: 'Регистрация',
			emailSubtitle: 'Несколько полей — и готово.',
			submit: 'Зарегистрироваться',
			useEmail: 'Зарегистрироваться через почту',
			haveAccount: 'Уже есть аккаунт?',
			switch: 'Войти'
		},
		field: {
			name: 'Имя',
			email: 'Email',
			password: 'Пароль',
			passwordHint: 'Пароль, минимум {{min}} символов',
			confirmation: 'Повторите пароль',
			code: 'Код подтверждения'
		},
		verify: {
			eyebrow: 'Почти готово',
			title: 'Подтвердите почту',
			description: 'Введите код из {{length}} цифр, отправленный на {{email}}.',
			submit: 'Подтвердить почту',
			resendLabel: 'Не получили код?',
			resend: 'Отправить новый',
			later: 'Подтвердить позже'
		},
		reset: {
			eyebrow: 'Восстановление доступа',
			title: 'Сброс пароля',
			description:
				'Укажите почту, с которой регистрировались. Если на ней есть аккаунт, код уже в пути.',
			submit: 'Отправить код',
			backToSignIn: 'Вернуться ко входу'
		},
		newPassword: {
			eyebrow: 'Последний шаг',
			title: 'Новый пароль',
			description: 'Введите код, отправленный на {{email}}, и придумайте новый пароль.',
			submit: 'Сохранить пароль',
			requestAnother: 'Запросить новый код',
			remembered: 'Вспомнили пароль? Войти'
		},
		otp: {
			remaining: 'действует ещё {{time}}',
			expired: 'Код устарел'
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
			confirmationMismatch: 'Пароли не совпадают',
			codeRequired: 'Введите код из письма',
			codeIncomplete: 'Код состоит из {{length}} цифр'
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
