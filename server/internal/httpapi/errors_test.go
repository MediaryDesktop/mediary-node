package httpapi

import (
	"errors"
	"testing"

	"github.com/danielgtaylor/huma/v2"

	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
)

func problemOf(t *testing.T, err error) *huma.ErrorModel {
	t.Helper()

	var model *huma.ErrorModel
	if !errors.As(ToHTTP(err), &model) {
		t.Fatalf("ToHTTP(%v) is not a problem document", err)
	}

	return model
}

// A client acts on the code, so it must reach the wire as the problem's type
// whatever the message says.
func TestACodeBecomesTheProblemType(t *testing.T) {
	coded := problemOf(t, apperr.New(apperr.KindPrecondition, "choose a folder").WithCode(apperr.CodeBooksFolderMissing))

	if coded.Type != "urn:mediary:problem:books-folder-missing" || coded.Status != 428 {
		t.Fatalf("type %q, status %d", coded.Type, coded.Status)
	}

	reworded := problemOf(t, apperr.New(apperr.KindPrecondition, "pick another place").WithCode(apperr.CodeBooksFolderMissing))
	if reworded.Type != coded.Type {
		t.Fatalf("rewording the message changed the type to %q", reworded.Type)
	}
}

func TestAnErrorWithoutACodeKeepsTheDefaultType(t *testing.T) {
	plain := problemOf(t, apperr.New(apperr.KindPrecondition, "at most 5 repositories"))

	if plain.Type != "" || plain.Detail != "at most 5 repositories" {
		t.Fatalf("type %q, detail %q", plain.Type, plain.Detail)
	}
}

func TestACodeSurvivesWrapping(t *testing.T) {
	inner := apperr.New(apperr.KindPrecondition, "FFmpeg was not found").WithCode(apperr.CodeToolMissing)

	if got := apperr.CodeOf(errors.Join(errors.New("while probing"), inner)); got != apperr.CodeToolMissing {
		t.Fatalf("code %q", got)
	}

	if got := apperr.CodeOf(errors.New("plain")); got != "" {
		t.Fatalf("a plain error has code %q", got)
	}
}

func TestAFieldProblemKeepsItsLocationAndCode(t *testing.T) {
	err := &apperr.Error{Kind: apperr.KindInvalid, Field: "url", Message: "not an address", Code: apperr.CodeSetupRequired}
	model := problemOf(t, err)

	if len(model.Errors) != 1 || model.Errors[0].Location != "url" || model.Type == "" {
		t.Fatalf("%+v", model)
	}
}
