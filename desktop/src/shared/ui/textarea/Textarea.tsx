import clsx from 'clsx'
import type { Ref, TextareaHTMLAttributes } from 'react'

import styles from './Textarea.module.scss'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
	ref?: Ref<HTMLTextAreaElement>
}

export function Textarea({ className, rows = 4, ...props }: TextareaProps) {
	return <textarea {...props} rows={rows} className={clsx(styles.textarea, className)} />
}
