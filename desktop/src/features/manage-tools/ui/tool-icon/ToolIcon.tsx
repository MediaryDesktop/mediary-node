import type { ToolId } from '@entities/tool'

// The real mark of each program, in its own brand color — unlike the shared
// Icon sprite, which resets every glyph to currentColor on purpose (it is for
// tintable UI icons, not for a tool's own identity).
//
// Paths and colors are Simple Icons' traced marks (CC0 1.0 — simpleicons.org),
// not mpv's or FFmpeg's own assets: neither project ships one. "mpv" and
// "FFmpeg" are trademarks of their respective owners; showing their mark here
// identifies the program Mediary installs, and claims no affiliation with it.
const PATHS: Record<ToolId, { color: string; d: string }> = {
	mpv: {
		color: '#691F69',
		d: 'M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm.312 22.775c-6.153 0-11.142-4.988-11.142-11.142S6.16.491 12.312.491c6.154 0 11.142 4.989 11.142 11.142s-4.988 11.142-11.142 11.142zm.643-20.464a8.587 8.587 0 1 0 0 17.174 8.587 8.587 0 0 0 0-17.174zm-1.113 15.257a5.517 5.517 0 1 1 0-11.034 5.517 5.517 0 0 1 0 11.034zm-1.399-7.995L14.4 11.97l-3.957 2.518V9.573z'
	},
	ffmpeg: {
		color: '#007808',
		d: 'M21.72 17.91V6.5l-.53-.49L9.05 18.52l-1.29-.06L24 1.53l-.33-.95-11.93 1-5.75 6.6v-.23l4.7-5.39-1.38-.77-9.11.77v2.85l1.91.46v.01l.19-.01-.56.66v10.6c.609-.126 1.22-.241 1.83-.36L14.12 5.22l.83-.04L0 21.44l9.67.82 1.35-.77 6.82-6.74v2.15l-5.72 5.57 11.26.95.35-.94v-3.16l-3.29-.18c.434-.403.858-.816 1.28-1.23z'
	}
}

export interface ToolIconProps {
	tool: ToolId
	size?: number
	className?: string
}

export function ToolIcon({ tool, size = 24, className }: ToolIconProps) {
	const mark = PATHS[tool]

	return (
		<svg
			className={className}
			width={size}
			height={size}
			viewBox='0 0 24 24'
			fill={mark.color}
			role='img'
			aria-hidden
		>
			<path d={mark.d} />
		</svg>
	)
}
