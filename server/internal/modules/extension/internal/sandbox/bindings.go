package sandbox

import (
	"fmt"
	"strings"

	"github.com/dop251/goja"
)

// bind gives the runtime its four globals and nothing else. Only plain
// values and functions built here cross over: no Go struct is handed to the
// script, so it has no Go method or field to reach for.
func (s *session) bind() error {
	s.errorCtor = s.vm.Get("Error")

	jsonObj := s.vm.Get("JSON").ToObject(s.vm)
	parse, ok := goja.AssertFunction(jsonObj.Get("parse"))
	if !ok {
		return fmt.Errorf("the runtime has no JSON.parse")
	}
	s.jsonParse = parse

	for name, value := range map[string]any{
		"fetch":     s.fetch,
		"parseHTML": s.parseHTML,
		"console":   s.console(),
		"config":    s.config(),
	} {
		if err := s.vm.Set(name, value); err != nil {
			return fmt.Errorf("bind %s: %w", name, err)
		}
	}

	return nil
}

// jsError is a plain JavaScript Error, so a plugin's catch sees what it would
// see in a browser.
func (s *session) jsError(format string, args ...any) *goja.Object {
	obj, err := s.vm.New(s.errorCtor, s.vm.ToValue(fmt.Sprintf(format, args...)))
	if err != nil {
		return s.vm.NewTypeError(fmt.Sprintf(format, args...))
	}

	return obj
}

func (s *session) rejected(err *goja.Object) goja.Value {
	promise, _, reject := s.vm.NewPromise()
	_ = reject(err)

	return s.vm.ToValue(promise)
}

func (s *session) resolved(value any) goja.Value {
	promise, resolve, _ := s.vm.NewPromise()
	_ = resolve(value)

	return s.vm.ToValue(promise)
}

// config is the plugin's settings, frozen: a plugin reads them, it does not
// get to rewrite what the user chose.
func (s *session) config() goja.Value {
	obj := s.vm.NewObject()
	for key, value := range s.plugin.Config {
		_ = obj.Set(key, value)
	}

	freeze, ok := goja.AssertFunction(s.vm.Get("Object").ToObject(s.vm).Get("freeze"))
	if ok {
		_, _ = freeze(nil, obj)
	}

	return obj
}

const maxLogLine = 1000

func (s *session) console() *goja.Object {
	obj := s.vm.NewObject()

	for _, level := range []string{"log", "warn", "error"} {
		_ = obj.Set(level, func(call goja.FunctionCall) goja.Value {
			s.logLines++
			switch {
			case s.logLines == s.limits.MaxLogLines+1:
				s.logger.Warn().Msg("the plugin logs too much; the rest of this search is not logged")
				return goja.Undefined()
			case s.logLines > s.limits.MaxLogLines:
				return goja.Undefined()
			}

			parts := make([]string, 0, len(call.Arguments))
			for _, arg := range call.Arguments {
				parts = append(parts, arg.String())
			}
			line := clip(strings.Join(parts, " "), maxLogLine)

			event := s.logger.Info()
			switch level {
			case "warn":
				event = s.logger.Warn()
			case "error":
				event = s.logger.Error()
			}
			event.Msg(line)

			return goja.Undefined()
		})
	}

	return obj
}
