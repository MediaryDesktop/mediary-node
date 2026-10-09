import { describe, expect, it } from 'vitest'

import { bookFileName, isPdf, pdfFraction, pdfLocator, pdfPage } from './book'

describe('book files', () => {
	it('names a book by its type', () => {
		expect(bookFileName('application/x-fictionbook+xml')).toBe('book.fb2')
		expect(bookFileName('application/epub+zip')).toBe('book.epub')
		expect(bookFileName('text/plain')).toBe('book.bin')
		expect(isPdf('application/pdf')).toBe(true)
	})

	it('keeps a PDF page as its locator', () => {
		expect(pdfPage(pdfLocator(41))).toBe(41)
		expect(pdfPage('epubcfi(/6/4!/4/2/1:0)')).toBeNull()
		expect(pdfPage(null)).toBeNull()
	})

	it('reads the first page as the start and the last as the end', () => {
		expect(pdfFraction(0, 300)).toBe(0)
		expect(pdfFraction(299, 300)).toBe(1)
		expect(pdfFraction(0, 1)).toBe(1)
	})
})
