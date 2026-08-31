package service

import (
	"context"

	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/extension/internal/store"
)

type Service struct {
	store  *store.Store
	logger zerolog.Logger
}

func New(st *store.Store, logger zerolog.Logger) *Service {
	return &Service{
		store:  st,
		logger: logger,
	}
}

func (s *Service) Status(context.Context) (bool, error) {
	return s.store.Ready(), nil
}
