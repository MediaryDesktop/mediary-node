package sandbox

import (
	"strings"

	"github.com/PuerkitoBio/goquery"
	"github.com/andybalholm/cascadia"
	"github.com/dop251/goja"
)

// parseHTML reads a page into a selection of its root, without running any of
// the page's scripts: goquery only builds the tree.
func (s *session) parseHTML(call goja.FunctionCall) goja.Value {
	raw := call.Argument(0)
	if !isString(raw) {
		panic(s.jsError("parseHTML: the page has to be a string"))
	}

	html := raw.String()
	if int64(len(html)) > s.limits.MaxBody {
		panic(s.jsError("parseHTML: the page is larger than a response may be"))
	}

	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		panic(s.jsError("parseHTML: %s", err.Error()))
	}

	return s.selection(doc.Selection)
}

// selection wraps elements in the cheerio-like object plugin.d.ts describes.
// The goquery value stays on the Go side; the script only gets functions.
func (s *session) selection(sel *goquery.Selection) *goja.Object {
	obj := s.vm.NewObject()

	_ = obj.Set("length", sel.Length())

	_ = obj.Set("find", func(selector string) goja.Value {
		return s.selection(s.find(sel, selector))
	})
	_ = obj.Set("first", func() goja.Value { return s.selection(sel.First()) })
	_ = obj.Set("eq", func(index int) goja.Value { return s.selection(sel.Eq(index)) })
	_ = obj.Set("text", func() string { return sel.Text() })

	_ = obj.Set("attr", func(name string) goja.Value {
		value, ok := sel.Attr(name)
		if !ok {
			return goja.Undefined()
		}
		return s.vm.ToValue(value)
	})

	_ = obj.Set("each", func(fn goja.Callable) goja.Value {
		sel.EachWithBreak(func(i int, element *goquery.Selection) bool {
			result, err := fn(goja.Undefined(), s.vm.ToValue(i), s.selection(element))
			if err != nil {
				panic(err)
			}
			// As in jQuery: returning false stops the walk.
			if stop, isBool := result.Export().(bool); isBool && !stop {
				return false
			}
			return true
		})
		return obj
	})

	_ = obj.Set("map", func(fn goja.Callable) goja.Value {
		values := make([]any, 0, sel.Length())
		sel.Each(func(i int, element *goquery.Selection) {
			result, err := fn(goja.Undefined(), s.vm.ToValue(i), s.selection(element))
			if err != nil {
				panic(err)
			}
			values = append(values, result)
		})
		return s.vm.NewArray(values...)
	})

	return obj
}

// find says so when a selector does not parse: goquery would quietly match
// nothing, and the plugin's author would be left wondering why.
func (s *session) find(sel *goquery.Selection, selector string) *goquery.Selection {
	if _, err := cascadia.Compile(selector); err != nil {
		panic(s.jsError("find: %q is not a selector: %s", selector, err.Error()))
	}

	return sel.Find(selector)
}
