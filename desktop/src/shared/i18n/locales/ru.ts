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

	datePicker: {
		previousMonth: 'Предыдущий месяц',
		nextMonth: 'Следующий месяц',
		previousYear: 'Предыдущий год',
		nextYear: 'Следующий год'
	},

	nav: {
		label: 'Основная навигация',
		home: 'Главная',
		discover: 'Обзор',
		search: 'Поиск',
		lists: 'Мои списки',
		library: 'Локальная библиотека',
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
		cancel: 'Отменить',
		breadcrumbs: 'Путь навигации'
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
			anyGenre: 'Любой жанр',
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
			renameTitle: 'Редактировать список',
			create: 'Создать список',
			save: 'Сохранить',
			rename: 'Переименовать',
			delete: 'Удалить',
			deleteTitle: 'Удалить «{{name}}»?',
			deleteHintAniList:
				'Список исчезнет из вашего аккаунта AniList. Тайтлы из него останутся в ваших списках',
			deleteHintLocal: 'Список исчезнет с этого компьютера. Тайтлы из него останутся в ваших списках',
			options: 'Действия со списком',
			nameLabel: 'Название списка',
			nameHint: 'Его можно изменить позже',
			iconLabel: 'Иконка',
			iconHint:
				'Показывается рядом с названием списка. Если ни одна не подходит — оставьте стандартную',
			iconDefault: 'Стандартная',
			iconSearch: 'Поиск иконок (по-английски)',
			iconCount: '{{count}} иконок',
			iconNoMatches: 'Иконки с таким названием нет',
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
		addEntry: {
			action: 'Добавить в список',
			title: 'Добавить в список',
			save: 'Добавить',
			done: '{{title}} добавлено в ваш список AniList'
		},
		manageEntry: {
			action: 'Управлять списками',
			title: 'Управлять списками',
			save: 'Сохранить изменения',
			statusHint: 'Где этот тайтл в ваших списках AniList',
			lists: 'Списки',
			listsHint: 'Нажмите на список, чтобы добавить или убрать тайтл',
			listsEmpty: 'Для этого типа медиа ещё нет кастомных списков'
		},
		rateEntry: {
			action: 'Оценка и заметки',
			title: 'Оценка и заметки',
			scoreHint: 'Оценка в формате, который использует ваш аккаунт AniList',
			progressHint: 'Синхронизируется с вашим списком AniList',
			repeatHint: 'Сколько раз вы проходили это снова',
			started: {
				anime: 'Начало просмотра',
				manga: 'Начало чтения'
			},
			dateHint: 'Необязательно — оставьте пустым, если не помните',
			completed: {
				anime: 'Завершение просмотра',
				manga: 'Завершение чтения'
			},
			completedLocked: 'Доступно, когда тайтл завершён, брошен или пересматривается',
			notes: 'Заметки',
			notesHint: 'Личные заметки, которые видите только вы',
			notesPlaceholder: 'Всё, что хотите запомнить'
		},
		removeFromList: 'Убрать из списка',
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
			delayed:
				'Сохранено на этом компьютере. Изменение попадёт в AniList, как только он станет доступен'
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

	library: {
		description: 'Управление локальными файлами, папками и сопоставлениями тайтлов',
		summary: {
			files_one: '{{count}} файл',
			files_few: '{{count}} файла',
			files_many: '{{count}} файлов',
			files_other: '{{count}} файла',
			filesOf_one: '{{count}}/{{total}} серия',
			filesOf_few: '{{count}}/{{total}} серии',
			filesOf_many: '{{count}}/{{total}} серий',
			filesOf_other: '{{count}}/{{total}} серии',
			unmatched_one: '{{count}} без тайтла',
			unmatched_few: '{{count}} без тайтла',
			unmatched_many: '{{count}} без тайтла',
			unmatched_other: '{{count}} без тайтла',
			titles_one: '{{count}} тайтл',
			titles_few: '{{count}} тайтла',
			titles_many: '{{count}} тайтлов',
			titles_other: '{{count}} тайтла'
		},
		empty: {
			title: 'Папок библиотеки пока нет',
			description:
				'Укажите ноде папку с вашими файлами. Она обойдёт и подпапки, а найденное автоматически дополнит деталями',
			action: 'Добавить папку в настройках'
		},
		root: {
			add: 'Добавить папку',
			remove: 'Убрать эту папку',
			removeFailed: 'Не удалось убрать папку',
			failed: 'Не удалось добавить папку',
			overlap: 'Эта папка пересекается с той, которую нода уже отслеживает',
			files_one: '{{count}} файл',
			files_few: '{{count}} файла',
			files_many: '{{count}} файлов',
			files_other: '{{count}} файла',
			missing_one: '{{count}} отсутствует',
			missing_few: '{{count}} отсутствуют',
			missing_many: '{{count}} отсутствуют',
			missing_other: '{{count}} отсутствует',
			section: 'Корни библиотеки',
			menu: 'Действия с папкой',
			rescan: 'Пересканировать эту папку',
			none: 'Папок пока нет'
		},
		scan: {
			start: 'Сканировать',
			folders: 'Папки',
			allFolders: 'Все папки библиотеки',
			failed: 'Не удалось запустить сканирование',
			noRoots: 'Добавьте папку библиотеки в настройках, чтобы сканировать',
			running: 'Сканирование…',
			title: 'Сканирование библиотеки',
			walking: 'Обход папок',
			probing: 'Чтение длительностей',
			matching: 'Сопоставление тайтлов',
			roots_one: '{{done}} из {{count}} папки',
			roots_few: '{{done}} из {{count}} папок',
			roots_many: '{{done}} из {{count}} папок',
			roots_other: '{{done}} из {{count}} папки',
			foundFiles_one: 'найден {{count}} файл',
			foundFiles_few: 'найдено {{count}} файла',
			foundFiles_many: 'найдено {{count}} файлов',
			foundFiles_other: 'найдено {{count}} файла',
			ofTotal: '{{done}} из {{total}}',
			neverRun: 'Ещё не сканировали',
			finished: 'Завершено {{when}}',
			matchedFiles_one: 'сопоставлено {{count}}',
			matchedFiles_few: 'сопоставлено {{count}}',
			matchedFiles_many: 'сопоставлено {{count}}',
			matchedFiles_other: 'сопоставлено {{count}}',
			allRead: 'Все папки прочитаны',
			tally: {
				added: 'Новых',
				changed: 'Изменённых',
				missing: 'Пропавших'
			},
			failedTitle: 'Не удалось прочитать:',
			showMore_one: 'Показать ещё {{count}}',
			showMore_few: 'Показать ещё {{count}}',
			showMore_many: 'Показать ещё {{count}}',
			showMore_other: 'Показать ещё {{count}}',
			showLess: 'Свернуть',
			failures: 'Папки, которые не удалось прочитать',
			rootFailed: 'Папку не удалось прочитать: {{reason}}'
		},
		explorer: {
			title: 'Проводник библиотеки',
			search: 'Поиск файлов и папок…',
			nothing: 'По этому фильтру ничего нет',
			pickSomething: 'Выберите файл или папку, чтобы увидеть, что о них знает нода',
			folderMeta: '{{matched}} из {{count}} сопоставлено',
			selectRow: 'Выбрать {{name}}',
			extension: 'Файл {{extension}}',
			folder: 'Папка',
			path: 'Путь',
			libraryFile: 'Файл библиотеки',
			files: 'Файлов',
			matchedTitle: 'Тайтл',
			season: 'Сезон',
			episode: 'Эпизод',
			duration: 'Длительность',
			size: 'Размер',
			kind: 'Тип',
			form: 'Форма',
			unmatchedPill_one: '{{count}} несопоставленный файл',
			unmatchedPill_few: '{{count}} несопоставленных файла',
			unmatchedPill_many: '{{count}} несопоставленных файлов',
			unmatchedPill_other: '{{count}} несопоставленного файла',
			matchFiles_one: 'Сопоставить {{count}} файл',
			matchFiles_few: 'Сопоставить {{count}} файла',
			matchFiles_many: 'Сопоставить {{count}} файлов',
			matchFiles_other: 'Сопоставить {{count}} файла',
			unmatchFiles_one: 'Отвязать {{count}} файл',
			unmatchFiles_few: 'Отвязать {{count}} файла',
			unmatchFiles_many: 'Отвязать {{count}} файлов',
			unmatchFiles_other: 'Отвязать {{count}} файла',
			ignoreFiles_one: 'Отложить {{count}} файл',
			ignoreFiles_few: 'Отложить {{count}} файла',
			ignoreFiles_many: 'Отложить {{count}} файлов',
			ignoreFiles_other: 'Отложить {{count}} файла',
			unignoreFiles_one: 'Вернуть {{count}} файл',
			unignoreFiles_few: 'Вернуть {{count}} файла',
			unignoreFiles_many: 'Вернуть {{count}} файлов',
			unignoreFiles_other: 'Вернуть {{count}} файла',
			deleteFiles_one: 'Удалить {{count}} файл',
			deleteFiles_few: 'Удалить {{count}} файла',
			deleteFiles_many: 'Удалить {{count}} файлов',
			deleteFiles_other: 'Удалить {{count}} файла',
			deleteTitle_one: 'Удалить {{count}} файл с диска?',
			deleteTitle_few: 'Удалить {{count}} файла с диска?',
			deleteTitle_many: 'Удалить {{count}} файлов с диска?',
			deleteTitle_other: 'Удалить {{count}} файла с диска?',
			andMore_one: 'и ещё {{count}}',
			andMore_few: 'и ещё {{count}}',
			andMore_many: 'и ещё {{count}}',
			andMore_other: 'и ещё {{count}}',
			filterAction: 'Фильтр',
			filterActive: 'Фильтр: {{filter}}',
			select: 'Выбрать',
			selecting: 'Выбор',
			refresh: 'Перечитать дерево',
			kinds: {
				video: 'Видео',
				manga: 'Комикс',
				book: 'Книга'
			},
			filter: {
				unmatched: 'Несопоставленные файлы',
				auto: 'Сопоставленные нодой',
				ignored: 'Отложенные файлы',
				missing: 'Отсутствующие файлы'
			}
		},
		toolbar: {
			explorer: 'Проводник библиотеки',
			refresh: 'Обновить',
			refreshHint: 'Пересканировать библиотеку',
			scanHint: 'Сканировать библиотеку',
			resolveUnmatched_one: 'Разобрать несопоставленные ({{count}})',
			resolveUnmatched_few: 'Разобрать несопоставленные ({{count}})',
			resolveUnmatched_many: 'Разобрать несопоставленные ({{count}})',
			resolveUnmatched_other: 'Разобрать несопоставленные ({{count}})',
			ignoredFiles: 'Отложенные файлы',
			scanSummaries: 'Итоги сканирований',
			more: 'Другие действия с библиотекой'
		},
		unmatched: {
			title: 'Несопоставленные файлы',
			empty: 'У всех файлов есть тайтл',
			previous: 'Предыдущая',
			next: 'Следующая',
			sourceId: 'AniList ID',
			matchSelection: 'Сопоставить выбранные',
			selectAll: 'Выбрать все файлы',
			fetchSuggestions: 'Подобрать варианты',
			ignoreSelection: 'Отложить выбранные',
			pickTitle: 'Выберите тайтл',
			confidence: 'Совпадение {{percent}}%',
			onYourList: 'В вашем списке',
			ignoredTitle: 'Отложенные файлы',
			noneIgnored: 'Отложенных файлов нет',
			unignoreSelection: 'Вернуть выбранные',
			ignoreFailed_one: 'Не удалось отложить {{count}} файл',
			ignoreFailed_few: 'Не удалось отложить {{count}} файла',
			ignoreFailed_many: 'Не удалось отложить {{count}} файлов',
			ignoreFailed_other: 'Не удалось отложить {{count}} файла'
		},
		history: {
			title: 'Итоги сканирований',
			description: 'Все сканирования, которые выполнила нода',
			empty: 'Сканирований ещё не было',
			partial: 'Прервано',
			matchedTitle: 'Сопоставленные тайтлы',
			unmatchedTitle: 'Не удалось сопоставить',
			notYetOnYourList: 'Ещё не в вашем списке',
			nothingToShow: 'Этому сканированию нечего показать',
			search: 'Поиск по имени файла…',
			scanned_one: 'Просканирован {{count}} тайтл',
			scanned_few: 'Просканировано {{count}} тайтла',
			scanned_many: 'Просканировано {{count}} тайтлов',
			scanned_other: 'Просканировано {{count}} тайтла',
			notMatched_one: '{{count}} файл не сопоставлен',
			notMatched_few: '{{count}} файла не сопоставлены',
			notMatched_many: '{{count}} файлов не сопоставлены',
			notMatched_other: '{{count}} файла не сопоставлены',
			onYourList: 'В вашем списке',
			filesScanned_one: 'Просканирован {{count}} файл',
			filesScanned_few: 'Просканировано {{count}} файла',
			filesScanned_many: 'Просканировано {{count}} файлов',
			filesScanned_other: 'Просканировано {{count}} файла',
			openExplorer: 'Открыть в проводнике библиотеки',
			scannerLogs: 'Журнал сканера',
			parsedTitle: 'Прочитано из названия:',
			logMatched: 'Сопоставлено на {{percent}}%',
			logRejected: 'Ближайший тайтл — {{percent}}%, ниже порога',
			logNothing: 'Не с чем сравнить'
		},
		search: 'Поиск по названию, тайтлу, файлу…',
		view: {
			all: 'Все',
			unmatched: 'Без тайтла',
			missing: 'Отсутствуют'
		},
		group: {
			matched: 'Сопоставлено',
			unmatched: 'Без тайтла',
			season: 'Сезон {{number}}',
			seasons_one: '{{count}} сезон',
			seasons_few: '{{count}} сезона',
			seasons_many: '{{count}} сезонов',
			seasons_other: '{{count}} сезона',
			episodes_one: '{{count}} серия',
			episodes_few: '{{count}} серии',
			episodes_many: '{{count}} серий',
			episodes_other: '{{count}} серии',
			more_one: 'ещё {{count}} серия',
			more_few: 'ещё {{count}} серии',
			more_many: 'ещё {{count}} серий',
			more_other: 'ещё {{count}} серии',
			less: 'Свернуть'
		},
		loading: 'Читаем библиотеку…',
		failed: 'Нода не вернула библиотеку',
		retry: 'Повторить',
		noFiles: 'Пока ничего не сканировали',
		noFilesHint: 'Нажмите «Сканировать», чтобы нода обошла добавленные папки',
		noMatches: 'Под этот фильтр не подходит ни один файл',
		truncated: 'Показано {{shown}} из {{total}} файлов',
		file: {
			missing: 'Отсутствует',
			matched: 'Сопоставлено {{percent}}%',
			matchedByHand: 'Сопоставлено вручную',
			unmatched: 'Без тайтла',
			play: 'Смотреть',
			match: 'Сопоставить',
			change: 'Изменить',
			clear: 'Забыть сопоставление',
			ignore: 'Не трогать этот файл',
			unignore: 'Снова учитывать',
			ignored: 'Отложен',
			ignoreFailed: 'Не удалось отложить файл',
			deleteFile: 'Удалить с диска',
			deleteFileTitle: 'Удалить этот файл?',
			deleteFileWarning: 'Файл будет удалён с этого компьютера. Это нельзя отменить.',
			deleteFailed: 'Не удалось удалить файл',
			unknownTitle: 'Не распознано',
			season: 'Сезон {{number}}',
			episode: 'Серия {{number}}',
			chapter: 'Глава {{number}}',
			menu: 'Действия с файлом',
			reveal: 'Показать в папке'
		},
		form: {
			series: 'Серия',
			movie: 'Фильм',
			special: 'Спешл',
			extra: 'Дополнительное',
			manga: 'Глава',
			book: 'Книга'
		},
		match: {
			group_one: '{{count}} файл будет сопоставлен с выбранным тайтлом',
			group_few: '{{count}} файла будут сопоставлены с выбранным тайтлом',
			group_many: '{{count}} файлов будут сопоставлены с выбранным тайтлом',
			group_other: '{{count}} файла будут сопоставлены с выбранным тайтлом',
			someFailed_one: 'Не удалось сопоставить {{count}} файл',
			someFailed_few: 'Не удалось сопоставить {{count}} файла',
			someFailed_many: 'Не удалось сопоставить {{count}} файлов',
			someFailed_other: 'Не удалось сопоставить {{count}} файла',
			title: 'Что это за файл?',
			loading: 'Спрашиваем источник…',
			loadFailed: 'Не удалось получить варианты',
			failed: 'Не удалось сохранить сопоставление',
			none: 'Вариантов нет',
			noneHint:
				'Ничего достаточно похожего источник не знает. Обычно помогает переименовать файл ближе к названию тайтла',
			tracked: 'В вашем списке',
			noSource: 'Источник метаданных не подключён',
			offline: 'Нода недоступна'
		}
	},

	media: {
		searchTorrents: 'Искать торренты',
		downloadMissing_one: 'Загрузить · не хватает {{count}}',
		downloadMissing_few: 'Загрузить · не хватает {{count}}',
		downloadMissing_many: 'Загрузить · не хватает {{count}}',
		downloadMissing_other: 'Загрузить · не хватает {{count}}',
		back: 'Назад',
		failed: 'Не удалось загрузить тайтл',
		retry: 'Повторить',
		offline: 'Подробности сейчас недоступны. Показываем то, что известно из вашего списка',
		openOn: 'Открыть на {{name}}',
		addToList: 'Добавить в список',
		trailer: 'Трейлер',
		trailerFor: 'Трейлер: {{title}}',
		downloadBatch: 'Скачать пакет / {{count}} эпизодов',
		comingSoon: 'Скоро будет',
		nextAiringDay: 'Эпизод {{episode}} {{when}}',
		views: {
			library: 'Локальная библиотека',
			torrent: 'Торренты'
		},
		chapters: {
			title: 'Главы · {{count}}'
		},
		library: {
			notInLibrary: 'Нет в вашей библиотеке',
			episodesNotInLibrary: 'Этих эпизодов нет в вашей библиотеке:',
			episode: 'Эпизод {{number}}',
			metadataUnavailable: 'Ни один источник пока не знает эпизодов этого тайтла',
			andMore: 'И другие…',
			toWatch: 'Дальше к просмотру',
			specials: 'Спешлы',
			others: 'Другое',
			play: 'Смотреть: {{name}}',
			playing: 'Играет',
			watched: 'Просмотрено',
			missing: 'Последний скан не нашёл файл',
			minutes: '{{count}} мин',
			aired: 'Вышел {{date}}',
			about: 'Об эпизоде',
			previous: 'Предыдущие эпизоды',
			next: 'Следующие эпизоды'
		},
		menu: {
			label: 'Больше действий',
			details: 'Подробности',
			addToLibrary: 'Добавить в библиотеку'
		},
		sections: {
			synopsis: 'Описание',
			details: 'Подробности',
			relations: 'Связанные тайтлы'
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
		subtitle: 'Находите аниме, мангу, дорамы, фильмы, сериалы и книги',
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
			manga: 'Манга',
			movie: 'Фильмы',
			series: 'Сериалы',
			dorama: 'Дорамы'
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

	player: {
		play: 'Воспроизвести',
		pause: 'Пауза',
		mute: 'Выключить звук',
		unmute: 'Включить звук',
		volume: 'Громкость',
		seek: 'Позиция',
		audio: 'Аудиодорожка',
		subtitles: 'Субтитры',
		subtitlesOff: 'Выключены',
		fullscreen: 'На весь экран',
		exitFullscreen: 'Выйти из полноэкранного режима',
		minimize: 'Назад к странице',
		expand: 'Открыть плеер',
		failed: 'Встроенный плеер не смог воспроизвести этот файл.',
		loadFailed: 'Не удалось прочитать этот файл.',
		needsTranscode:
			'Этот файл использует кодеки, которые встроенный плеер пока не декодирует. Его можно открыть в mpv.',
		openExternally: 'Открыть в mpv'
	},
	reader: {
		close: 'Назад',
		pageAlt: 'Страница {{number}}',
		empty: 'В этой главе нет страниц, которые можно показать.',
		counted: 'Зачтено как прочитанное',
		read: 'Прочитано',
		loadFailed: 'Не удалось открыть эту главу.',
		seek: 'Страница',
		previousChapter: 'Предыдущая глава',
		nextChapter: 'Следующая глава',
		pageOf: '{{current}} / {{total}}',
		end: 'Конец главы',
		chapterNumber: 'Глава {{number}}'
	},
	playback: {
		episode: 'Серия {{number}}',
		watched: 'Зачтено как просмотренное',
		pause: 'Пауза',
		resume: 'Продолжить',
		stop: 'Закрыть плеер',
		failed: 'Не удалось запустить плеер'
	},

	placeholder: {
		discover: 'Здесь появятся рекомендации и свежие релизы, как только будет подключён облачный каталог',
		downloads: 'Источники торрентов и очередь загрузок, которой управляет нода'
	},

	mangaSources: {
		none: 'Серверов пока нет',
		add: 'Добавить OPDS-сервер',
		menu: 'Действия с сервером',
		edit: 'Изменить',
		remove: 'Удалить',
		removeFailed: 'Не удалось удалить сервер',
		saveFailed: 'Не удалось сохранить сервер',
		drawer: {
			createTitle: 'Добавить OPDS-сервер',
			editTitle: 'Изменить OPDS-сервер',
			description:
				'Адрес корневого фида каталога, например http://nas:25600/opds/v1.2/catalog для Komga',
			nameLabel: 'Название',
			namePlaceholder: 'Komga дома',
			urlLabel: 'Адрес',
			usernameLabel: 'Имя пользователя',
			passwordLabel: 'Пароль',
			passwordHint: 'Нода хранит его в отдельном файле и больше никогда не показывает',
			passwordKept: 'Оставьте пустым, чтобы сохранить текущий пароль',
			create: 'Добавить',
			save: 'Сохранить',
			check: 'Проверить соединение',
			ok: 'Соединение есть',
			problems: {
				unauthorized: 'Сервер не принял имя пользователя или пароль',
				not_opds: 'По этому адресу нет OPDS-каталога',
				unreachable: 'Не удалось соединиться с сервером',
				other_host: 'Каталог ссылается на другой сервер'
			}
		},
		chapters: {
			external: 'На сайте издателя',
			library: 'Библиотека',
			all: 'Все источники',
			filter: 'Источник',
			copies: 'Другие копии',
			link: 'Найти на сервере',
			relink: 'Сменить серию',
			unlink: 'Отвязать',
			from: 'с {{name}}',
			empty: 'В привязанной серии нет глав, которые можно читать постранично',
			loadFailed: 'Не удалось загрузить главы онлайн',
			pages_one: '{{count}} страница',
			pages_few: '{{count}} страницы',
			pages_many: '{{count}} страниц',
			pages_other: '{{count}} страницы'
		},
		mangadex: {
			enable: 'Читать главы с MangaDex',
			languages: 'Языки, по приоритету',
			languagesPlaceholder: 'Выберите языки',
			note: 'Страницы читаются онлайн через ноду и не сохраняются. MangaDex и переводчики указаны рядом с каждой главой.',
			unavailable: 'MangaDex выключен на этой ноде',
			saveFailed: 'Не удалось сохранить настройки MangaDex'
		},
		downloads: {
			save: 'Сохранить на диск',
			saveAll: 'Сохранить всё на диск',
			queued_one: '{{count}} глава в очереди',
			queued_few: '{{count}} главы в очереди',
			queued_many: '{{count}} глав в очереди',
			queued_other: '{{count}} главы в очереди',
			failedToQueue: 'Не удалось поставить в очередь',
			folderTitle: 'Куда сохранять главы',
			folderDescription:
				'Главы сохраняются как CBZ в папке библиотеки, поэтому сразу появляются в библиотеке',
			noFolders: 'Сначала добавьте папку библиотеки в настройках',
			folderPlaceholder: 'Выберите папку',
			title: 'Главы манги',
			empty: 'Пока ничего не сохранено',
			cancel: 'Остановить',
			retry: 'Попробовать снова',
			forget: 'Убрать из списка',
			progress: '{{done}} / {{total}} страниц',
			states: {
				queued: 'Ожидает',
				running: 'Сохраняется',
				done: 'Сохранено',
				failed: 'Ошибка',
				cancelled: 'Остановлено'
			}
		},
		link: {
			matched: 'Совпадает с AniList',
			title: 'Найти серию',
			description: 'Выберите серию, в которой лежат главы этого тайтла',
			sourceLabel: 'Сервер',
			searchLabel: 'Название серии',
			search: 'Искать',
			noResults: 'На этом сервере ничего не найдено',
			choose: 'Выбрать',
			failed: 'Не удалось привязать серию'
		}
	},
	torrents: {
		section: {
			hint: 'Ищите раздачи, добавляйте свои и получайте новые серии автоматически'
		},
		setup: {
			openSettings: 'Открыть настройки',
			noClient: 'Торрент-клиент не выбран',
			noClientHint: 'Выберите встроенный клиент или подключите qBittorrent в настройках.',
			unreachable: 'Торрент-клиент не отвечает',
			noSources: 'Нет источника поиска',
			noSourcesHint: 'Добавьте Jackett или Prowlarr в настройках, чтобы искать раздачи.'
		},
		add: 'Добавить торрент',
		drawer: {
			title: 'Добавить торрент',
			description: 'Для «{{title}}». После загрузки его видео появятся в библиотеке под этим тайтлом.',
			magnetLabel: 'Magnet-ссылка',
			magnetPlaceholder: 'magnet:?xt=urn:btih:…',
			fileLabel: 'Или файл .torrent',
			chooseFile: 'Выбрать файл .torrent',
			clearFile: 'Убрать файл',
			fileUnreadable: 'Не удалось прочитать этот файл',
			submit: 'Загрузить',
			failed: 'Не удалось добавить торрент',
			chooseFiles: 'Выбрать серии перед загрузкой'
		},
		files: {
			title: 'Выбор файлов',
			choose: 'Выбрать файлы',
			start: 'Загрузить выбранное',
			save: 'Сохранить',
			failed: 'Не удалось изменить файлы',
			loading: 'Загрузка списка файлов…',
			waiting: 'Ожидаем список файлов торрента. Magnet-ссылка сначала получает его от пиров.',
			selected: 'Выбрано {{count}} · {{size}}',
			hint: 'Серии, которые уже есть в библиотеке, не выбраны',
			all: 'Все',
			missing: 'Недостающие серии',
			none: 'Ни одного',
			episode: 'Сер. {{number}}',
			inLibrary: 'в библиотеке'
		},
		search: {
			addedMany_one: 'Добавлена {{count}} загрузка',
			addedMany_few: 'Добавлено {{count}} загрузки',
			addedMany_many: 'Добавлено {{count}} загрузок',
			addedMany_other: 'Добавлено {{count}} загрузок',
			covers_one: '{{count}} недостающая серия',
			covers_few: '{{count}} недостающие серии',
			covers_many: '{{count}} недостающих серий',
			covers_other: '{{count}} недостающих серий',
			noEpisode: 'Без номера серии в названии',
			emptyHint: 'Попробуйте другой запрос или выключите фильтры.',
			results_one: '{{count}} результат',
			results_few: '{{count}} результата',
			results_many: '{{count}} результатов',
			results_other: '{{count}} результатов',
			onlyMissing: 'Только с недостающими сериями',
			kind: {
				label: 'Раздачи',
				all: 'Все',
				episodes: 'Серии',
				batches: 'Пакеты'
			},
			downloadSelected: 'Загрузить ({{count}})',
			nothingMissing: 'Все серии уже есть',
			missing: 'Недостающие серии:',
			open: 'Искать торренты',
			drawerTitle: 'Поиск торрентов',
			placeholder: 'Поиск по названиям тайтла или своему запросу',
			episode: 'Серия',
			submit: 'Искать',
			best: 'Лучшая',
			bestIs: 'Лучшая: {{title}}',
			downloadBest: 'Загрузить лучшую',
			queries: 'Искали: {{queries}}',
			noSources: 'Добавьте Jackett или Prowlarr в настройках, чтобы искать раздачи.',
			failed: 'Поиск не удался',
			sourceFailed: '{{name}} не ответил: {{error}}',
			empty: 'Ничего не найдено',
			download: 'Загрузить',
			added: 'Добавлено в загрузки',
			page: 'Открыть страницу раздачи',
			episodes: 'Сер. {{from}}–{{to}}',
			match: {
				episode: 'Эта серия',
				batch: 'Пакет'
			}
		},
		sources: {
			none: 'Источников поиска пока нет',
			add: 'Добавить источник',
			edit: 'Изменить',
			remove: 'Удалить',
			menu: 'Действия с источником',
			removeFailed: 'Не удалось удалить источник',
			createTitle: 'Новый источник поиска',
			editTitle: 'Изменить источник поиска',
			description: 'Torznab-лента из Jackett или Prowlarr. Какие сайты она ищет, настраивается там.',
			nameLabel: 'Название',
			urlLabel: 'Адрес Torznab',
			urlHint:
				'Jackett: «Copy Torznab Feed» у индексатора или лента «all». Prowlarr: Torznab-адрес индексатора',
			keyLabel: 'API-ключ',
			keyKept: 'Оставьте пустым, чтобы сохранить текущий ключ',
			keyHint: 'Виден на главной странице Jackett или Prowlarr',
			check: 'Проверить источник',
			ok: '{{title}} отвечает и умеет искать',
			noSearch: '{{title}} отвечает, но не принимает поиск',
			unreachable: 'Источник не ответил',
			save: 'Сохранить',
			create: 'Добавить',
			saveFailed: 'Не удалось сохранить источник'
		},
		profile: {
			resolution: 'Разрешение',
			codec: 'Кодек',
			any: 'Любое',
			minSeeders: 'Минимум сидов',
			preferred: 'Желаемые слова, от самого важного — группы, сайты',
			excluded: 'Никогда не выбирать раздачи с этими словами',
			save: 'Сохранить предпочтения',
			saveFailed: 'Не удалось сохранить предпочтения'
		},
		auto: {
			addedToast_one: 'Добавлена {{count}} загрузка',
			addedToast_few: 'Добавлено {{count}} загрузки',
			addedToast_many: 'Добавлено {{count}} загрузок',
			addedToast_other: 'Добавлено {{count}} загрузок',
			queryShort: 'поиск «{{query}}»',
			emptyHint: 'Включите автозагрузку на вкладке «Торренты» тайтла.',
			emptyTitle: 'Правил пока нет',
			intro: 'Правила каждые 30 минут ищут в ваших источниках и добавляют лучшую раздачу каждой новой серии. Правило включается и настраивается на вкладке «Торренты» тайтла.',
			settings: 'Настройки правила',
			panelHint: 'Новые серии загружаются сами, проверка каждые 30 минут',
			panelTitle: 'Автозагрузка',
			enable: 'Автоматически загружать новые серии',
			remove: 'Убрать правило',
			hint: 'Каждые 30 минут Mediary ищет в ваших источниках и добавляет лучшую раздачу каждой серии, которой нет в библиотеке, а из пакетной раздачи берёт только недостающие серии.',
			from: 'С серии',
			fromShort: 'с серии {{episode}}',
			query: 'Искать',
			queryPlaceholder: 'Названия тайтла',
			save: 'Сохранить',
			preview: 'Что будет загружено',
			checkNow: 'Проверить сейчас',
			lastChecked_one: 'Проверено {{when}}, добавлено {{count}}',
			lastChecked_few: 'Проверено {{when}}, добавлено {{count}}',
			lastChecked_many: 'Проверено {{when}}, добавлено {{count}}',
			lastChecked_other: 'Проверено {{when}}, добавлено {{count}}',
			nothing: 'Нового для загрузки нет',
			wouldAdd_one: 'Будет добавлена {{count}} серия',
			wouldAdd_few: 'Будет добавлено {{count}} серии',
			wouldAdd_many: 'Будет добавлено {{count}} серий',
			wouldAdd_other: 'Будет добавлено {{count}} серий',
			added_one: 'Добавлена {{count}} серия',
			added_few: 'Добавлено {{count}} серии',
			added_many: 'Добавлено {{count}} серий',
			added_other: 'Добавлено {{count}} серий',
			saveFailed: 'Не удалось сохранить правило',
			checkFailed: 'Проверка не удалась',
			listTitle: 'Автозагрузка',
			on: 'Включено',
			off: 'Выключено'
		},
		list: {
			emptyForTitleHint: 'Найдите раздачи или добавьте magnet-ссылку.',
			emptyHint: 'Найдите раздачу на вкладке «Торренты» тайтла.',
			inLibrary: 'В библиотеке: {{count}}',
			active: 'Активные: {{count}}',
			title: 'Торренты',
			forTitle: 'Загрузки этого тайтла',
			empty: 'Торрент-загрузок пока нет',
			emptyForTitle: 'Для этого тайтла пока ничего не загружено'
		},
		states: {
			choosing: 'Ждёт выбора файлов',
			downloading: 'Загружается',
			paused: 'На паузе',
			stalled: 'Ищет пиров',
			queued: 'В очереди qBittorrent',
			checking: 'Проверка файлов',
			metadata: 'Получение метаданных торрента',
			error: 'qBittorrent сообщает об ошибке',
			importing: 'Добавляется в библиотеку',
			done: 'В библиотеке',
			failed: 'Не удалось',
			unknown: 'Ожидает qBittorrent'
		},
		meta: {
			down: 'Скорость загрузки',
			speed: '{{speed}}/с',
			seeds: '{{seeds}} сидов · {{peers}} пиров',
			eta: 'осталось {{time}}',
			imported_one: '{{count}} локальный файл',
			imported_few: '{{count}} локальных файла',
			imported_many: '{{count}} локальных файлов',
			imported_other: '{{count}} локальных файлов'
		},
		pause: 'Пауза',
		resume: 'Продолжить',
		remove: 'Убрать из списка',
		removeWithFiles: 'Убрать вместе с файлами',
		menu: 'Действия с загрузкой',
		actionFailed: 'Не удалось изменить загрузку',
		client: {
			notConfigured: 'Выберите торрент-клиент в настройках, чтобы загружать торренты',
			unreachable: 'qBittorrent не отвечает: {{error}}',
			openSettings: 'Открыть настройки'
		},
		settings: {
			clientLabel: 'Торрент-клиент',
			embedded: 'Встроенный',
			none: 'Нет',
			embeddedHint:
				'Mediary загружает торренты сама, больше ничего устанавливать не нужно. Ждёт пиров на порту 42069 и не открывает его на роутере.',
			qbittorrentHint:
				'Ваш qBittorrent через его Web UI. Включите Web UI в qBittorrent: Настройки → Веб-интерфейс.',
			noneHint: 'Торренты выключены.',
			notConfigured: 'Не подключено',
			configure: 'Подключить',
			edit: 'Изменить',
			drawerTitle: 'Торрент-клиент',
			drawerDescription: 'Какой клиент загружает торренты в библиотеку.',
			urlLabel: 'Адрес Web UI',
			usernameLabel: 'Имя пользователя',
			passwordLabel: 'Пароль',
			passwordKept: 'Оставьте пустым, чтобы сохранить текущий пароль',
			passwordHint: 'Оставьте пустым, если Web UI пускает этот компьютер без пароля',
			check: 'Проверить соединение',
			ok: 'Подключено к qBittorrent {{version}}',
			folderLabel: 'Папка загрузок',
			folderHint: 'Папка библиотеки, куда сохраняются торренты, по подпапке на тайтл',
			folderPlaceholder: 'Выберите папку библиотеки',
			mappingLabel: 'Соответствие путей',
			mappingHint:
				'Только если qBittorrent работает в Docker или на другом компьютере и видит папку загрузок под другим путём. Заполните оба поля или ни одного.',
			mappingClient: 'Папка, как её видит qBittorrent',
			mappingNode: 'Та же папка на этом компьютере',
			save: 'Сохранить',
			saveFailed: 'Не удалось сохранить настройки'
		}
	},
	downloads: {
		subtitle: 'Торренты, правила, которые добавляют их сами, и сохранённые главы манги',
		tabs: {
			torrents: 'Торренты',
			auto: 'Автозагрузка',
			manga: 'Главы манги'
		}
	},
	settings: {
		sections: {
			app: {
				title: 'Приложение',
				subtitle: 'Внешний вид, язык и первичная настройка'
			},
			library: {
				title: 'Локальная библиотека',
				subtitle: 'Папки, которые нода сканирует на медиа'
			},
			player: {
				title: 'Воспроизведение видео',
				subtitle: 'Каким плеером открывать видео'
			},
			torrentClient: {
				title: 'Торрент-клиент',
				subtitle: 'Куда загружаются торренты'
			},
			torrentSearch: {
				title: 'Поиск торрентов',
				subtitle: 'Источники Torznab для поиска раздач'
			},
			torrentPreferences: {
				title: 'Выбор раздач',
				subtitle: 'Какие раздачи поиск ставит первыми'
			},
			mangaSources: {
				title: 'Источники манги',
				subtitle: 'Каталоги OPDS с мангой и книгами'
			},
			mangaDex: {
				title: 'MangaDex',
				subtitle: 'Чтение глав онлайн'
			},
			mangaDownloads: {
				title: 'Загрузка манги',
				subtitle: 'Где хранятся загруженные главы'
			}
		},
		mangaDex: {
			name: 'MangaDex',
			hint: 'Читать главы онлайн с MangaDex'
		},
		mangaDownloads: {
			name: 'Загрузки манги',
			hint: 'Папка библиотеки, куда сохраняются главы в формате CBZ'
		},
		torrents: {
			name: 'Торренты',
			hint: 'Клиент, который загружает торренты в вашу библиотеку'
		},
		torrentSearch: {
			name: 'Поиск торрентов',
			hint: 'Ваш Jackett или Prowlarr через Torznab. Своих индексаторов в Mediary нет'
		},
		releaseProfile: {
			name: 'Предпочтения по раздачам',
			hint: 'Что поиск ставит первым и выбирает как лучшую раздачу'
		},
		mangaSources: {
			name: 'Источники манги',
			hint: 'Ваши собственные OPDS-каталоги — Komga, Kavita, Calibre-Web — откуда читать главы'
		},
		appearance: {
			name: 'Внешний вид',
			hint: 'Светлая или тёмная тема для всего приложения'
		},
		language: {
			name: 'Язык',
			hint: 'Язык интерфейса. Названия в каталоге остаются на своих языках'
		},
		library: {
			name: 'Папки библиотеки',
			hint: 'Папки, которые нода обходит при сканировании. Подпапки тоже'
		},
		player: {
			name: 'Плеер',
			hint: 'Где открываются серии: в приложении или в mpv',
			modes: {
				builtin: 'Встроенный',
				external: 'mpv'
			}
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
