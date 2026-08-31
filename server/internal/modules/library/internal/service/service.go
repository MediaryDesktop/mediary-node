package service

import (
	"context"

	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/library/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
)

type Service struct {
	store  *store.Store
	logger zerolog.Logger
	hub    *events.Hub
}

func New(st *store.Store, logger zerolog.Logger, hub *events.Hub) *Service {
	return &Service{
		store:  st,
		logger: logger,
		hub:    hub,
	}
}

func (s *Service) Status(context.Context) (bool, error) {
	return s.store.Ready(), nil
}
