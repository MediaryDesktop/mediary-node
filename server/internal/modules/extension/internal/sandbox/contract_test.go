package sandbox

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/dop251/goja"
)

// These tests pin what the plugin contract leans on in goja itself, before
// any binding exists: if an upgrade of goja broke one, plugins would break
// with it.

// call runs provider.search(request) and settles the promise it returns.
// goja runs a promise's jobs as the outermost call returns, so a fetch that
// resolves at once has settled by then.
func call(t *testing.T, vm *goja.Runtime, script string) goja.Value {
	t.Helper()

	if _, err := vm.RunString(script); err != nil {
		t.Fatalf("load: %v", err)
	}

	provider, err := vm.RunString("new Provider()")
	if err != nil {
		t.Fatalf("construct: %v", err)
	}

	search, ok := goja.AssertFunction(provider.ToObject(vm).Get("search"))
	if !ok {
		t.Fatal("Provider has no search method")
	}

	result, err := search(provider, vm.ToValue(map[string]any{"query": "frieren 01"}))
	if err != nil {
		t.Fatalf("search: %v", err)
	}

	return result
}

func settled(t *testing.T, value goja.Value) *goja.Promise {
	t.Helper()

	promise, ok := value.Export().(*goja.Promise)
	if !ok {
		t.Fatalf("search returned %T, want a promise", value.Export())
	}

	return promise
}

// A fetch that does its work in Go before returning hands the script a
// promise that is already settled: await works, and no event loop is needed.
func blockingFetch(vm *goja.Runtime, body string) func(goja.FunctionCall) goja.Value {
	return func(call goja.FunctionCall) goja.Value {
		url := call.Argument(0).String()

		promise, resolve, _ := vm.NewPromise()
		response := vm.NewObject()
		_ = response.Set("ok", true)
		_ = response.Set("url", url)
		_ = response.Set("text", func() goja.Value {
			p, r, _ := vm.NewPromise()
			_ = r(body)
			return vm.ToValue(p)
		})
		_ = resolve(response)

		return vm.ToValue(promise)
	}
}

func TestAsyncClassWithBlockingFetch(t *testing.T) {
	vm := goja.New()
	_ = vm.Set("fetch", blockingFetch(vm, "<tr>one</tr><tr>two</tr>"))

	result := call(t, vm, `
		class Provider {
			async search(request) {
				const page = await fetch('https://tracker.example.org/?q=' + encodeURIComponent(request.query))
				const html = await page.text()
				return [...html.matchAll(/<tr>(\w+)<\/tr>/g)].map(([, title]) => ({ title, url: page.url }))
			}
		}
	`)

	promise := settled(t, result)
	if promise.State() != goja.PromiseStateFulfilled {
		t.Fatalf("promise is %v: %v", promise.State(), promise.Result())
	}

	releases, ok := promise.Result().Export().([]any)
	if !ok || len(releases) != 2 {
		t.Fatalf("got %#v, want two releases", promise.Result().Export())
	}

	first := releases[0].(map[string]any)
	if first["title"] != "one" || !strings.Contains(first["url"].(string), "frieren%2001") {
		t.Fatalf("first release %#v", first)
	}
}

func TestThrowRejectsWithTheMessage(t *testing.T) {
	vm := goja.New()

	promise := settled(t, call(t, vm, `
		class Provider {
			async search() { throw new Error('the site answered 503') }
		}
	`))

	if promise.State() != goja.PromiseStateRejected {
		t.Fatalf("promise is %v", promise.State())
	}
	if !strings.Contains(promise.Result().String(), "the site answered 503") {
		t.Fatalf("rejected with %v", promise.Result())
	}
}

// A plugin that loops forever is stopped from outside, and the runtime says so.
func TestInterruptStopsAnEndlessLoop(t *testing.T) {
	vm := goja.New()

	timer := time.AfterFunc(50*time.Millisecond, func() { vm.Interrupt("time is up") })
	defer timer.Stop()

	done := make(chan error, 1)
	go func() {
		_, err := vm.RunString(`for (;;) {}`)
		done <- err
	}()

	select {
	case err := <-done:
		var interrupted *goja.InterruptedError
		if !errors.As(err, &interrupted) {
			t.Fatalf("stopped with %v, want an interrupt", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("the loop was not interrupted")
	}
}

// The example plugin is written the way authors write: classes, ??, **,
// destructuring, template strings. goja has to take all of it.
func TestExamplePluginCompiles(t *testing.T) {
	code, err := os.ReadFile(filepath.Join("..", "manifest", "testdata", "example", "plugin.js"))
	if err != nil {
		t.Fatal(err)
	}

	vm := goja.New()
	if _, runErr := vm.RunScript("plugin.js", string(code)); runErr != nil {
		t.Fatalf("goja cannot run the example: %v", runErr)
	}

	kind, err := vm.RunString("typeof Provider")
	if err != nil || kind.String() != "function" {
		t.Fatalf("Provider is %v (%v)", kind, err)
	}
}

// goja gives a bare runtime none of what a script could reach the machine
// with; the sandbox only adds what it means to.
func TestBareRuntimeHasNoWayOut(t *testing.T) {
	vm := goja.New()

	for _, name := range []string{"require", "process", "fetch", "XMLHttpRequest", "setTimeout", "Deno", "Bun", "module", "global"} {
		value, err := vm.RunString("typeof " + name)
		if err != nil {
			t.Fatal(err)
		}
		if value.String() != "undefined" {
			t.Errorf("%s is %s in a bare runtime", name, value)
		}
	}
}
