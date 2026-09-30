// The part of a name the search matched, marked, so a long list of files shows at
// a glance why each one is still on it.
export function Highlighted({ text, search }: { text: string; search: string }) {
	const needle = search.trim().toLowerCase()
	const at = needle === '' ? -1 : text.toLowerCase().indexOf(needle)

	if (at < 0) {
		return <>{text}</>
	}

	return (
		<>
			{text.slice(0, at)}
			<mark>{text.slice(at, at + needle.length)}</mark>
			{text.slice(at + needle.length)}
		</>
	)
}
