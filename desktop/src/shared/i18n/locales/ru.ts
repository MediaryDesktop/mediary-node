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
		search: 'Поиск',
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
				'Аниме и манга живут в вашем аккаунте AniList. Mediary читает и обновляет их с этого компьютера',
			open: 'Получить токен на AniList',
			tokenLabel: 'Токен доступа',
			tokenPlaceholder: 'Вставьте токен из AniList',
			tokenHint:
				'AniList откроется в браузере. Разрешите доступ, скопируйте показанный токен и вставьте его сюда',
			submit: 'Подключить',
			notConfigured: 'В этой сборке не настроен клиент AniList, поэтому вход недоступен',
			connectedAs: 'Подключено как {{name}}',
			disconnect: 'Отключить',
			failure: {
				rejected: 'AniList не принял этот токен. Скопируйте его ещё раз и повторите',
				unreachable: 'AniList сейчас недоступен. Проверьте соединение и повторите',
				unknown: 'Не удалось подключить аккаунт. Попробуйте ещё раз'
			}
		}
	},

	common: {
		cancel: 'Отменить'
	},

	lists: {
		listCount_one: '{{count}} список',
		listCount_few: '{{count}} списка',
		listCount_many: '{{count}} списков',
		listCount_other: '{{count}} списка',
		titleCount_one: '{{count}} тайтл',
		titleCount_few: '{{count}} тайтла',
		titleCount_many: '{{count}} тайтлов',
		titleCount_other: '{{count}} тайтла',
		pinned: 'Закреплённые',
		yours: 'Ваши списки',
		search: 'Поиск списков',
		filterAll: 'Все',
		seeAll: 'Показать все',
		noMatches: 'По этому запросу списков нет',
		noLists: 'Списков пока нет',
		filters: {
			search: 'Поиск в этом списке',
			anyStatus: 'Любой статус',
			anyFormat: 'Любой формат',
			noMatches: 'В этом списке нет тайтлов по таким фильтрам',
			reset: 'Сбросить',
			sort: {
				default: 'Порядок списка',
				title: 'По названию',
				score: 'По вашей оценке',
				progress: 'По прогрессу',
				updated: 'Недавно обновлённые'
			}
		},
		mediaType: {
			movie: 'Фильмы',
			series: 'Сериалы',
			dorama: 'Дорамы',
			anime: 'Аниме',
			book: 'Книги',
			manga: 'Манга'
		},
		sort: {
			recent: 'Недавно обновлённые',
			name: 'По названию',
			size: 'Самые большие'
		},
		view: {
			grid: 'Сетка',
			rows: 'Список'
		},
		card: {
			empty: 'Пустой',
			updated: 'Обновлён {{when}}',
			overflow: '+{{count}}'
		},
		shortcut: {
			watchlist: 'Запланированное',
			watchlistHint: 'Тайтлы, которые вы планируете посмотреть или прочитать',
			completed: 'Завершённое',
			completedHint: 'Всё, что вы прошли до конца',
			current: 'Сейчас смотрю'
		},
		manage: {
			new: 'Новый список',
			createTitle: 'Создать список',
			createSubtitle: 'Список держит один тип медиа, поэтому тайтлы остаются там, где им место',
			renameTitle: 'Переименовать список',
			create: 'Создать список',
			save: 'Сохранить',
			rename: 'Переименовать',
			delete: 'Удалить',
			options: 'Действия со списком',
			nameLabel: 'Название списка',
			nameHint: 'Его можно изменить позже',
			namePlaceholder: 'Напр. Посмотреть позже',
			typeLabel: 'Тип медиа',
			typeHintAniList: 'Списки аниме и манги создаются в вашем аккаунте AniList',
			typeHintLocal: 'Этот список хранится на этом компьютере',
			typeLocked: 'Список остаётся с тем типом медиа, с которым его создали',
			duplicate: 'Список с таким названием уже существует',
			notConnected: 'Подключите AniList, чтобы создавать списки аниме и манги',
			offline: 'AniList недоступен, поэтому сейчас этот список не изменить',
			failed: 'Не удалось сохранить список. Попробуйте ещё раз'
		},
		loading: 'Загружаем ваши списки…',
		failed: 'Не удалось загрузить списки',
		retry: 'Повторить',
		empty: 'Здесь пока пусто',
		connect: 'Подключите AniList, чтобы увидеть свои списки',
		pending: 'Ещё не синхронизировано',
		menu: 'Действия с тайтлом',
		decrement: 'На один меньше',
		increment: 'На один больше',
		updateFailed: 'Не удалось сохранить изменение. Попробуйте ещё раз',
		sync: {
			progress: 'Синхронизация с AniList…',
			done: 'Синхронизировано с AniList',
			delayed: 'Сохранено на этом компьютере. Изменение попадёт в AniList, как только он станет доступен'
		},
		episodes: 'Эп. {{progress}}',
		chapters: 'Гл. {{progress}}',
		editor: {
			status: 'Статус',
			score: 'Оценка',
			episodes: 'Эпизоды',
			chapters: 'Главы',
			volumes: 'Тома',
			repeat: 'Повторы'
		},
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

	media: {
		back: 'Назад',
		failed: 'Не удалось загрузить тайтл',
		retry: 'Повторить',
		offline: 'Подробности сейчас недоступны. Показываем то, что известно из вашего списка',
		openOn: 'Открыть на {{name}}',
		editEntry: 'Редактировать запись в списке',
		addToList: 'Добавить в список',
		trailer: 'Трейлер',
		trailerFor: 'Трейлер: {{title}}',
		downloadBatch: 'Скачать пакет / {{count}} эпизодов',
		comingSoon: 'Скоро будет',
		nextAiringDay: 'Эпизод {{episode}} {{when}}',
		views: {
			library: 'Локальная библиотека',
			torrent: 'Торрент-стриминг'
		},
		library: {
			notInLibrary: 'Нет в вашей библиотеке',
			episodesNotInLibrary: 'Этих эпизодов нет в вашей библиотеке:',
			episode: 'Эпизод {{number}}',
			metadataUnavailable: 'Данные об эпизодах пока недоступны — библиотека в разработке',
			andMore: 'И другие…'
		},
		menu: {
			label: 'Больше действий',
			details: 'Подробности',
			addToLibrary: 'Добавить в библиотеку'
		},
		sections: {
			synopsis: 'Описание',
			details: 'Подробности',
			relations: 'Связанные тайтлы',
			entry: 'Ваш список'
		},
		noDescription: 'Описания пока нет',
		stats: {
			averageScore: 'Средняя оценка',
			popularity: 'Пользователей',
			favourites: 'В избранном'
		},
		fields: {
			format: 'Формат',
			status: 'Статус',
			episodes: 'Эпизоды',
			chapters: 'Главы',
			volumes: 'Тома',
			duration: 'Длительность эпизода',
			start: 'Начало',
			end: 'Окончание',
			studios: 'Студии',
			source: 'Первоисточник',
			country: 'Страна',
			synonyms: 'Также известен как'
		},
		minutes: '{{count}} мин',
		format: {
			TV: 'ТВ',
			TV_SHORT: 'Короткий ТВ',
			MOVIE: 'Фильм',
			SPECIAL: 'Спешл',
			OVA: 'OVA',
			ONA: 'ONA',
			MUSIC: 'Клип',
			MANGA: 'Манга',
			NOVEL: 'Ранобэ',
			ONE_SHOT: 'Ваншот'
		},
		status: {
			FINISHED: 'Завершён',
			RELEASING: 'Выходит',
			NOT_YET_RELEASED: 'Ещё не вышел',
			CANCELLED: 'Отменён',
			HIATUS: 'На паузе'
		},
		season: {
			WINTER: 'Зима',
			SPRING: 'Весна',
			SUMMER: 'Лето',
			FALL: 'Осень'
		},
		relation: {
			ADAPTATION: 'Адаптация',
			PREQUEL: 'Приквел',
			SEQUEL: 'Сиквел',
			PARENT: 'Основная история',
			SIDE_STORY: 'Побочная история',
			CHARACTER: 'Персонаж',
			SUMMARY: 'Рекап',
			ALTERNATIVE: 'Альтернатива',
			SPIN_OFF: 'Спин-офф',
			OTHER: 'Другое',
			SOURCE: 'Первоисточник',
			COMPILATION: 'Компиляция',
			CONTAINS: 'Содержит'
		},
		origin: {
			ORIGINAL: 'Оригинал',
			MANGA: 'Манга',
			LIGHT_NOVEL: 'Ранобэ',
			VISUAL_NOVEL: 'Визуальная новелла',
			VIDEO_GAME: 'Видеоигра',
			OTHER: 'Другое',
			NOVEL: 'Роман',
			DOUJINSHI: 'Додзинси',
			ANIME: 'Аниме',
			WEB_NOVEL: 'Веб-новелла',
			LIVE_ACTION: 'Живые актёры',
			GAME: 'Игра',
			COMIC: 'Комикс',
			MULTIMEDIA_PROJECT: 'Мультимедийный проект',
			PICTURE_BOOK: 'Книжка с картинками'
		}
	},

	search: {
		searchPlaceholder: 'Название',
		searchLabel: 'Поиск по названию',
		filters: 'Фильтры',
		clear: 'Сбросить фильтры',
		adult: 'Показывать контент 18+',
		empty: 'Ничего не найдено. Попробуйте другое название или измените фильтры',
		failed: 'Не удалось выполнить поиск',
		loadMoreFailed: 'Не удалось загрузить ещё тайтлы',
		retry: 'Повторить',
		loadMore: 'Показать ещё',
		scoreAtLeast: 'От {{score}}%',
		type: {
			anime: 'Аниме',
			manga: 'Манга'
		},
		sort: {
			POPULARITY_DESC: 'Самые популярные',
			SEARCH_MATCH: 'По совпадению',
			TRENDING_DESC: 'В тренде',
			SCORE_DESC: 'По оценке',
			FAVOURITES_DESC: 'В избранном',
			START_DATE_DESC: 'Самые новые',
			TITLE_ROMAJI: 'По названию'
		},
		any: {
			genres: 'Все жанры',
			tags: 'Все теги',
			formats: 'Все форматы',
			seasons: 'Любой сезон',
			year: 'Любой год',
			statuses: 'Любой статус',
			score: 'Любая оценка'
		}
	},

	placeholder: {
		discover: 'Здесь появятся рекомендации и свежие релизы, как только будет подключён облачный каталог',
		library: 'Локальные файлы, которые сканирует нода и сопоставляет с тайтлами каталога',
		downloads: 'Источники торрентов и очередь загрузок, которой управляет нода'
	},

	settings: {
		appearance: {
			name: 'Внешний вид',
			hint: 'Светлая или тёмная тема для всего приложения'
		},
		language: {
			name: 'Язык',
			hint: 'Язык интерфейса. Названия в каталоге остаются на своих языках'
		},
		wizard: {
			name: 'Мастер настройки',
			hint: 'Пройти первичную настройку заново: папки, плеер, загрузки',
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
				'Аниме, манга, дорамы, фильмы, сериалы и книги — один каталог, один прогресс, на всех устройствах',
			aside: 'Аккаунт нужен только для облачного каталога и синхронизации. Локальная библиотека, плеер и загрузки работают и без него'
		},
		back: 'Вернуться назад',
		or: 'или',
		otherWay: 'Другой способ входа',
		providers: {
			label: 'Продолжить через',
			lastUsed: 'В прошлый раз',
			waiting: 'Ожидание {{provider}} в браузере',
			cancel: 'Отменить',
			unavailable: 'Не удалось загрузить способы входа',
			reload: 'Повторить',
			failed: 'Не удалось войти через {{provider}}. Попробуйте ещё раз'
		},
		signIn: {
			eyebrow: 'С возвращением',
			title: 'Привет!',
			subtitle: 'Выберите, как вам удобнее войти',
			emailTitle: 'Вход',
			emailSubtitle: 'Войдите, чтобы продолжить с того же места',
			submit: 'Войти',
			useEmail: 'Войти через почту и пароль',
			forgotPassword: 'Забыли пароль?',
			noAccount: 'Нет аккаунта?',
			switch: 'Зарегистрироваться'
		},
		signUp: {
			eyebrow: 'Присоединяйтесь',
			title: 'Создать аккаунт',
			subtitle: 'Выберите, как вам удобнее зарегистрироваться',
			emailTitle: 'Регистрация',
			emailSubtitle: 'Несколько полей — и готово',
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
			description: 'Введите код из {{length}} цифр, отправленный на {{email}}',
			submit: 'Подтвердить почту',
			resendLabel: 'Не получили код?',
			resend: 'Отправить новый'
		},
		reset: {
			eyebrow: 'Восстановление доступа',
			title: 'Сброс пароля',
			description:
				'Укажите почту, с которой регистрировались. Если на ней есть аккаунт, код уже в пути',
			submit: 'Отправить код',
			backToSignIn: 'Вернуться ко входу'
		},
		newPassword: {
			eyebrow: 'Последний шаг',
			title: 'Новый пароль',
			description: 'Введите код, отправленный на {{email}}, и придумайте новый пароль',
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
		pending: 'Этот шаг ещё не сделан',
		steps: {
			library: {
				label: 'Локальная библиотека',
				title: 'Локальная библиотека',
				description:
					'Выберите папки, где уже лежат ваши файлы. Mediary просканирует их и сопоставит найденное с каталогом'
			},
			player: {
				label: 'Плеер',
				title: 'Внешний плеер',
				description:
					'Выберите, чем воспроизводить аниме, фильмы и сериалы. Прогресс отслеживается автоматически'
			},
			downloads: {
				label: 'Загрузки',
				title: 'Загрузка файлов',
				description: 'Настройте торрент-клиент для загрузки'
			},
			anilist: {
				label: 'AniList',
				title: 'Подключите AniList',
				description:
					'Списки аниме и манги живут в вашем аккаунте AniList. Подключите его один раз, и Mediary будет держать их синхронизированными'
			},
			account: {
				label: 'Бэкап',
				title: 'Аккаунт Mediary',
				description:
					'Необязательно. Аккаунт Mediary только хранит бэкап ваших списков и настроек для других устройств'
			},
			debrid: {
				label: 'Debrid-сервис',
				title: 'Debrid-сервис',
				description: 'Debrid-сервисы ускоряют загрузки и дают мгновенный стриминг из облака'
			}
		},
		account: {
			blurb: 'Аккаунт Mediary необязателен: он только хранит бэкап ваших списков и настроек для переезда на другое устройство',
			google: 'Продолжить через Google',
			or: 'или',
			email: 'Продолжить через email'
		},
		library: {
			placeholder: 'Папка не выбрана',
			browse: 'Выбрать папку',
			video: {
				label: 'Видео',
				hint: 'Аниме, фильмы и сериалы. Вложенные папки тоже сканируются'
			},
			reading: {
				label: 'Чтение',
				hint: 'Манга, манхва и книги'
			},
			aside: 'Это можно пропустить и добавить папки позже — каталог работает и без локальной библиотеки'
		},
		player: {
			notice: 'Нода Mediary поставляется со встроенным плеером на mpv. Ниже всё равно можно настроить внешний',
			select: {
				label: 'Плеер для десктопа',
				mpv: 'MPV (Рекомендуется)',
				vlc: 'VLC',
				custom: 'Своя команда',
				hint: 'MPV рекомендуется для лучшего рендеринга субтитров и торрент-стриминга'
			},
			install: 'В Windows установите MPV через Scoop или Chocolatey. В macOS — через Homebrew'
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
			description: 'Адрес ошибочный, или экран убрали',
			home: 'На главную'
		},
		error: {
			title: 'Что-то пошло не так',
			description: 'Не удалось открыть экран. Попробуйте ещё раз или вернитесь на главную',
			retry: 'Попробовать ещё раз'
		}
	},
	home: {
		subtitle: 'Скелет фазы 0. Каталога ещё нет — это лишь проверка, что оболочка видит ноду',
		account: {
			title: 'Облачный аккаунт',
			anonymous: 'Вход не выполнен — каталог и синхронизация недоступны',
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
