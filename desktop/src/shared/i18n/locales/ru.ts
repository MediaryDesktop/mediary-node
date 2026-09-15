import type { Translation } from './en'

export const ru: Translation = {
	language: {
		en: 'English',
		uk: 'Українська',
		ru: 'Русский'
	},

	theme: {
		label: 'Тема',
		dark: 'Тёмная тема',
		light: 'Светлая тема'
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

	nav: {
		label: 'Основная навигация',
		home: 'Главная',
		discover: 'Обзор',
		catalog: 'Каталог',
		lists: 'Мои списки',
		library: 'Библиотека',
		downloads: 'Загрузки',
		settings: 'Настройки',
		signIn: 'Войти'
	},

	anilist: {
		connect: {
			title: 'AniList',
			description:
				'Аниме и манга живут в вашем аккаунте AniList. Mediary читает и обновляет их с этого компьютера.',
			open: 'Получить токен на AniList',
			tokenLabel: 'Токен доступа',
			tokenPlaceholder: 'Вставьте токен из AniList',
			tokenHint:
				'AniList откроется в браузере. Разрешите доступ, скопируйте показанный токен и вставьте его сюда.',
			submit: 'Подключить',
			notConfigured: 'В этой сборке не настроен клиент AniList, поэтому вход недоступен.',
			connectedAs: 'Подключено как {{name}}',
			disconnect: 'Отключить',
			failure: {
				rejected: 'AniList не принял этот токен. Скопируйте его ещё раз и повторите.',
				unreachable: 'AniList сейчас недоступен. Проверьте соединение и повторите.',
				unknown: 'Не удалось подключить аккаунт. Попробуйте ещё раз.'
			}
		}
	},

	lists: {
		tabs: {
			anime: 'Аниме',
			manga: 'Манга'
		},
		loading: 'Загружаем ваш список…',
		stale: 'Показаны сохранённые данные, пока AniList обновляется',
		failed: 'Не удалось загрузить список.',
		retry: 'Повторить',
		empty: 'Здесь пока пусто.',
		connect: 'Подключите AniList, чтобы увидеть свои списки',
		source: 'Данные из {{name}}',
		episodes: 'Эп. {{progress}}',
		chapters: 'Гл. {{progress}}',
		status: {
			anime: {
				CURRENT: 'Смотрю',
				PLANNING: 'В планах',
				COMPLETED: 'Просмотрено',
				DROPPED: 'Брошено',
				PAUSED: 'На паузе',
				REPEATING: 'Пересматриваю'
			},
			manga: {
				CURRENT: 'Читаю',
				PLANNING: 'В планах',
				COMPLETED: 'Прочитано',
				DROPPED: 'Брошено',
				PAUSED: 'На паузе',
				REPEATING: 'Перечитываю'
			}
		}
	},

	placeholder: {
		discover: 'Здесь появятся рекомендации и свежие релизы, как только будет подключён облачный каталог.',
		catalog: 'Поиск по всем типам медиа с фильтрами по жанру, году и рейтингу.',
		lists: 'Ваши статусы просмотра, оценки и собственные подборки.',
		library: 'Локальные файлы, которые сканирует нода и сопоставляет с тайтлами каталога.',
		downloads: 'Источники торрентов и очередь загрузок, которой управляет нода.'
	},

	settings: {
		appearance: {
			name: 'Внешний вид',
			hint: 'Светлая или тёмная тема для всего приложения.'
		},
		language: {
			name: 'Язык',
			hint: 'Язык интерфейса. Названия в каталоге остаются на своих языках.'
		},
		wizard: {
			name: 'Мастер настройки',
			hint: 'Пройти первичную настройку заново: папки, плеер, загрузки.',
			action: 'Открыть мастер'
		}
	},
	select: {
		placeholder: 'Выберите…',
		noResults: 'Ничего не найдено',
		clear: 'Очистить выбор',
		remove: 'Убрать {{label}}'
	},
	window: {
		minimize: 'Свернуть',
		maximize: 'Развернуть',
		restore: 'Восстановить',
		close: 'Закрыть'
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
			waiting: 'Ожидание {{provider}} в браузере.',
			cancel: 'Отменить',
			unavailable: 'Не удалось загрузить способы входа.',
			reload: 'Повторить',
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
			resend: 'Отправить новый'
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
			passwordRequired: 'Введите пароль',
			passwordTooShort: 'Пароль не менее {{min}} символов',
			passwordTooLong: 'Пароль не длиннее {{max}} символов',
			passwordLength: 'Пароль от {{min}} до {{max}} символов',
			passwordEchoesIdentity: 'Пароль не должен повторять email или имя',
			confirmationRequired: 'Повторите пароль',
			confirmationMismatch: 'Пароли не совпадают',
			codeRequired: 'Введите код из письма',
			codeIncomplete: 'Код состоит из {{length}} цифр',
			fieldInvalid: 'Проверьте поле «{{field}}»'
		},
		error: {
			cloudUnreachable: 'Не удалось связаться с облаком',
			requestFailed: 'Не удалось выполнить запрос'
		}
	},

	setup: {
		note: 'Эти настройки можно изменить позже',
		railLabel: 'Шаги настройки',
		progress: 'Шаг {{current}} из {{total}}',
		previous: 'Назад',
		next: 'Далее',
		finish: 'Завершить',
		pending: 'Этот шаг ещё не сделан.',
		steps: {
			library: {
				label: 'Локальная библиотека',
				title: 'Локальная библиотека',
				description:
					'Выберите папки, где уже лежат ваши файлы. Mediary просканирует их и сопоставит найденное с каталогом.'
			},
			player: {
				label: 'Плеер',
				title: 'Внешний плеер',
				description:
					'Выберите, чем воспроизводить аниме, фильмы и сериалы. Прогресс отслеживается автоматически.'
			},
			downloads: {
				label: 'Загрузки',
				title: 'Загрузка файлов',
				description: 'Настройте торрент-клиент для загрузки.'
			},
			anilist: {
				label: 'AniList',
				title: 'Подключите AniList',
				description:
					'Списки аниме и манги живут в вашем аккаунте AniList. Подключите его один раз, и Mediary будет держать их синхронизированными.'
			},
			account: {
				label: 'Бэкап',
				title: 'Аккаунт Mediary',
				description:
					'Необязательно. Аккаунт Mediary только хранит бэкап ваших списков и настроек для других устройств.'
			},
			debrid: {
				label: 'Debrid-сервис',
				title: 'Debrid-сервис',
				description: 'Debrid-сервисы ускоряют загрузки и дают мгновенный стриминг из облака.'
			}
		},
		account: {
			blurb: 'Аккаунт Mediary необязателен: он только хранит бэкап ваших списков и настроек для переезда на другое устройство.',
			google: 'Продолжить через Google',
			or: 'или',
			email: 'Продолжить через email'
		},
		library: {
			placeholder: 'Папка не выбрана',
			browse: 'Выбрать папку',
			video: {
				label: 'Видео',
				hint: 'Аниме, фильмы и сериалы. Вложенные папки тоже сканируются.'
			},
			reading: {
				label: 'Чтение',
				hint: 'Манга, манхва и книги.'
			},
			aside: 'Это можно пропустить и добавить папки позже — каталог работает и без локальной библиотеки.'
		},
		player: {
			notice: 'Нода Mediary поставляется со встроенным плеером на mpv. Ниже всё равно можно настроить внешний.',
			select: {
				label: 'Плеер для десктопа',
				mpv: 'MPV (Рекомендуется)',
				vlc: 'VLC',
				custom: 'Своя команда',
				hint: 'MPV рекомендуется для лучшего рендеринга субтитров и торрент-стриминга.'
			},
			install: 'В Windows установите MPV через Scoop или Chocolatey. В macOS — через Homebrew.'
		},
		downloading: {
			client: {
				title: 'Торрент-клиент',
				description: 'Клиент для загрузки торрентов',
				label: 'Клиент',
				qbittorrent: 'qBittorrent'
			},
			qbittorrent: {
				title: 'Настройки qBittorrent',
				host: 'Хост',
				username: 'Имя пользователя',
				password: 'Пароль',
				port: 'Порт',
				executable: 'Путь к исполняемому файлу'
			}
		},
		debrid: {
			label: 'Debrid-сервис',
			none: 'Нет',
			torbox: 'TorBox',
			realDebrid: 'Real-Debrid',
			allDebrid: 'AllDebrid',
			premiumize: 'Premiumize'
		}
	},

	fallback: {
		notFound: {
			title: 'Такого экрана нет',
			description: 'Адрес ошибочный, или экран убрали.',
			home: 'На главную'
		},
		error: {
			title: 'Что-то пошло не так',
			description: 'Не удалось открыть экран. Попробуйте ещё раз или вернитесь на главную.',
			retry: 'Попробовать ещё раз'
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
