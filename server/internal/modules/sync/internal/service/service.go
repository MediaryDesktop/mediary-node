package service

import (
	"context"

	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/sync/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/cloud"
	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
)

type Service struct {
	store       *store.Store
	logger      zerolog.Logger
	hub         *events.Hub
	cloudClient *cloud.Client
}

func New(st *store.Store, logger zerolog.Logger, hub *events.Hub, cloudClient *cloud.Client) *Service {
	return &Service{
		store:       st,
		logger:      logger,
		hub:         hub,
		cloudClient: cloudClient,
	}
}

func (s *Service) Status(context.Context) (bool, error) {
	return s.store.Ready(), nil
}
