package service

import (
	"errors"
	"os/exec"
	"testing"

	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
)

type missingProgram struct{}

func (missingProgram) Error() string          { return "ffmpeg was not found: install it" }
func (missingProgram) MissingProgram() string { return "ffmpeg" }

// The desktop offers to install the program by the code, not by the wording.
func TestAMissingProgramCarriesItsCode(t *testing.T) {
	for name, cause := range map[string]error{
		"found by the tools module": missingProgram{},
		"found by nothing":          exec.ErrNotFound,
	} {
		err := missingTool(cause, "ffmpeg")

		if apperr.KindOf(err) != apperr.KindPrecondition || apperr.CodeOf(err) != apperr.CodeToolMissing {
			t.Errorf("%s: kind %q, code %q", name, apperr.KindOf(err), apperr.CodeOf(err))
		}

		if !errors.Is(err, cause) {
			t.Errorf("%s: the cause is lost", name)
		}
	}
}

type noTools struct{}

func (noTools) Path(string) (string, error) { return "", missingProgram{} }

func TestAMissingPlayerCarriesItsCode(t *testing.T) {
	_, err := MPVLauncher{Tools: noTools{}}.Start(t.Context(), "episode.mkv", 0)

	if apperr.KindOf(err) != apperr.KindPrecondition || apperr.CodeOf(err) != apperr.CodeToolMissing {
		t.Fatalf("kind %q, code %q", apperr.KindOf(err), apperr.CodeOf(err))
	}
}
