package videofile

// Locate finds a program on every use, so one installed while the node runs is
// picked up without a restart. When there is none its error wraps
// exec.ErrNotFound. Nil runs the program by name from PATH.
type Locate func() (string, error)

// At always runs the program at path.
func At(path string) Locate {
	return func() (string, error) { return path, nil }
}

func (l Locate) path(name string) (string, error) {
	if l == nil {
		return name, nil
	}

	return l()
}
