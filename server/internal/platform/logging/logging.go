package logging

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/rs/zerolog"
	"gopkg.in/natefinch/lumberjack.v2"
)

func New(level string, pretty bool, file string) (zerolog.Logger, func(), error) {
	parsed, err := zerolog.ParseLevel(level)
	if err != nil {
		return zerolog.Nop(), func() {}, fmt.Errorf("parse log level %q: %w", level, err)
	}

	var console io.Writer = os.Stdout
	if pretty {
		console = zerolog.ConsoleWriter{Out: os.Stdout, TimeFormat: time.RFC3339}
	}

	if file == "" {
		logger := zerolog.New(console).Level(parsed).With().Timestamp().Logger()
		return logger, func() {}, nil
	}

	if err := os.MkdirAll(filepath.Dir(file), 0o700); err != nil {
		return zerolog.Nop(), func() {}, fmt.Errorf("create log directory: %w", err)
	}

	rotating := &lumberjack.Logger{
		Filename:   file,
		MaxSize:    10,
		MaxBackups: 3,
		MaxAge:     30,
		Compress:   true,
	}

	logger := zerolog.New(zerolog.MultiLevelWriter(console, rotating)).
		Level(parsed).
		With().
		Timestamp().
		Logger()

	return logger, func() { _ = rotating.Close() }, nil
}
