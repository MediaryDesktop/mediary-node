package sandbox

import (
	"context"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/dop251/goja"
)

// Headers a plugin cannot set: the transport owns them, or they would let a
// plugin pass for something it is not.
var reservedHeaders = map[string]bool{
	"host":                true,
	"user-agent":          true,
	"content-length":      true,
	"transfer-encoding":   true,
	"connection":          true,
	"keep-alive":          true,
	"upgrade":             true,
	"te":                  true,
	"trailer":             true,
	"proxy-connection":    true,
	"proxy-authorization": true,
}

// fetch is the browser's fetch, cut down to what a search needs: GET or POST,
// headers, a text body. It does all its work before returning, so the promise
// it hands back is already settled and the plugin's await needs no event loop.
func (s *session) fetch(call goja.FunctionCall) goja.Value {
	response, failure := s.do(call)
	if failure != "" {
		return s.rejected(s.jsError("fetch: %s", failure))
	}

	return s.resolved(response)
}

func (s *session) do(call goja.FunctionCall) (response *goja.Object, failure string) {
	s.requests++
	if s.requests > s.limits.MaxRequests {
		return nil, "a search makes at most " + strconv.Itoa(s.limits.MaxRequests) + " requests"
	}

	raw := call.Argument(0)
	if !isString(raw) {
		return nil, "the address has to be a string"
	}

	target, err := url.Parse(raw.String())
	if err != nil {
		return nil, raw.String() + " is not an address"
	}
	if err = s.hosts.checkURL(target); err != nil {
		return nil, err.Error()
	}

	method, headers, body, failure := s.init(call.Argument(1))
	if failure != "" {
		return nil, failure
	}

	ctx, cancel := context.WithTimeout(s.ctx, s.limits.Request)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, method, target.String(), body)
	if err != nil {
		return nil, err.Error()
	}
	for name, value := range headers {
		req.Header.Set(name, value)
	}
	req.Header.Set("User-Agent", s.agent)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, reason(err)
	}
	defer func() { _ = resp.Body.Close() }()

	data, err := io.ReadAll(io.LimitReader(resp.Body, s.limits.MaxBody+1))
	if err != nil {
		return nil, reason(err)
	}
	if int64(len(data)) > s.limits.MaxBody {
		return nil, "the response is larger than " + strconv.Itoa(int(s.limits.MaxBody>>20)) + " MB"
	}

	return s.response(resp, data), ""
}

// init reads fetch's second argument.
func (s *session) init(value goja.Value) (method string, headers map[string]string, body io.Reader, failure string) {
	method = http.MethodGet
	headers = map[string]string{}

	if value == nil || goja.IsUndefined(value) || goja.IsNull(value) {
		return method, headers, nil, ""
	}

	obj, ok := value.(*goja.Object)
	if !ok {
		return "", nil, nil, "the second argument has to be an object"
	}

	if m := obj.Get("method"); m != nil && !goja.IsUndefined(m) {
		method = strings.ToUpper(m.String())
		if method != http.MethodGet && method != http.MethodPost {
			return "", nil, nil, "only GET and POST"
		}
	}

	if h := obj.Get("headers"); h != nil && !goja.IsUndefined(h) && !goja.IsNull(h) {
		hobj, isObj := h.(*goja.Object)
		if !isObj {
			return "", nil, nil, "headers have to be an object"
		}
		for _, key := range hobj.Keys() {
			name := http.CanonicalHeaderKey(strings.TrimSpace(key))
			if reservedHeaders[strings.ToLower(name)] {
				return "", nil, nil, "the " + name + " header is set by the node"
			}
			headers[name] = hobj.Get(key).String()
		}
	}

	if b := obj.Get("body"); b != nil && !goja.IsUndefined(b) && !goja.IsNull(b) {
		if method != http.MethodPost {
			return "", nil, nil, "only a POST has a body"
		}
		if !isString(b) {
			return "", nil, nil, "the body has to be a string"
		}
		text := b.String()
		if len(text) > s.limits.MaxRequestBody {
			return "", nil, nil, "the body is too large"
		}
		body = strings.NewReader(text)
	}

	return method, headers, body, ""
}

func (s *session) response(resp *http.Response, data []byte) *goja.Object {
	obj := s.vm.NewObject()
	_ = obj.Set("ok", resp.StatusCode >= 200 && resp.StatusCode < 300)
	_ = obj.Set("status", resp.StatusCode)
	_ = obj.Set("url", resp.Request.URL.String())

	header := resp.Header
	headers := s.vm.NewObject()
	_ = headers.Set("get", func(name string) goja.Value {
		values := header.Values(name)
		if len(values) == 0 {
			return goja.Null()
		}
		return s.vm.ToValue(strings.Join(values, ", "))
	})
	_ = obj.Set("headers", headers)

	text := string(data)
	_ = obj.Set("text", func() goja.Value { return s.resolved(text) })
	_ = obj.Set("json", func() goja.Value {
		parsed, err := s.jsonParse(goja.Undefined(), s.vm.ToValue(text))
		if err != nil {
			return s.rejected(s.jsError("the response is not JSON"))
		}
		return s.resolved(parsed)
	})

	return obj
}

func isString(value goja.Value) bool {
	if value == nil {
		return false
	}
	_, ok := value.Export().(string)

	return ok
}
