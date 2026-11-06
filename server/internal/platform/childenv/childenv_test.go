package childenv

import (
	"os/exec"
	"slices"
	"testing"
)

func TestFilterDropsTheNodesOwnVariables(t *testing.T) {
	got := Filter([]string{
		"PATH=/usr/bin",
		"NODE_TOKEN=secret",
		"node_cloud_device_token=secret",
		"NODE_TMDB_API_KEY=secret",
		"NODEJS=kept",
		"SystemRoot=C:\\Windows",
		"=C:=C:\\",
	})

	want := []string{"PATH=/usr/bin", "NODEJS=kept", "SystemRoot=C:\\Windows", "=C:=C:\\"}
	if !slices.Equal(got, want) {
		t.Errorf("Filter = %q, want %q", got, want)
	}
}

func TestApplyFiltersTheInheritedEnvironment(t *testing.T) {
	t.Setenv("NODE_TOKEN", "secret")
	t.Setenv("MEDIARY_CHILDENV_PROBE", "kept")

	cmd := exec.CommandContext(t.Context(), "true")
	Apply(cmd)

	if slices.ContainsFunc(cmd.Env, func(e string) bool { return e == "NODE_TOKEN=secret" }) {
		t.Error("the local token reached the child's environment")
	}
	if !slices.Contains(cmd.Env, "MEDIARY_CHILDENV_PROBE=kept") {
		t.Error("the rest of the environment was not passed on")
	}
}

func TestApplyKeepsAnEnvironmentAlreadySet(t *testing.T) {
	cmd := exec.CommandContext(t.Context(), "true")
	cmd.Env = []string{"A=1", "NODE_TOKEN=secret"}

	Apply(cmd)

	if !slices.Equal(cmd.Env, []string{"A=1"}) {
		t.Errorf("Env = %q, want [A=1]", cmd.Env)
	}
}
