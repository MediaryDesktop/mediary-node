package service

import (
	"context"
	"strings"
	"time"

	"github.com/MediaryDesktop/mediary-node/server/internal/platform/ai"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/cloud"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/secrets"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/sources/claude"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/sources/gemini"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/sources/openai"
)

const (
	ProviderCloud  = "cloud"
	ProviderClaude = "claude"
	ProviderGemini = "gemini"
	ProviderOpenAI = "openai"

	providerEntry = "ai.provider"

	// Reading the cloud's allowance is decoration on a settings page; it must
	// not hold the page up when the cloud is slow.
	quotaTimeout = 5 * time.Second
)

// AIProviders is every model the node can ask to fill in a title. Any of them
// may be nil when the node was started without it; Store keeps which one the
// user chose.
type AIProviders struct {
	Store  *secrets.Store
	Cloud  *cloud.Client
	Claude *claude.Client
	Gemini *gemini.Client
	OpenAI *openai.Client
}

// AISettings is which AI fills in titles and how each one is set up. Keys
// never leave the node.
type AISettings struct {
	Provider string          `json:"provider" enum:"cloud,claude,gemini,openai" doc:"The AI that answers. cloud is Mediary's free AI, on the cloud's key within a daily allowance; the others use the user's own key."`
	Ready    bool            `json:"ready" doc:"Whether the chosen AI can answer right now."`
	Cloud    CloudAISettings `json:"cloud"`
	Claude   KeyedAISettings `json:"claude"`
	Gemini   KeyedAISettings `json:"gemini"`
	OpenAI   OpenAISettings  `json:"openai"`
}

type CloudAISettings struct {
	Linked    bool       `json:"linked" doc:"Whether the node is paired with a Mediary Cloud account, which the free AI needs."`
	Known     bool       `json:"known" doc:"Whether the cloud told the node its allowance. False when it is not paired or could not be reached."`
	Enabled   bool       `json:"enabled" doc:"Whether the cloud offers AI at all."`
	Limit     int        `json:"limit" doc:"Requests per day."`
	Used      int        `json:"used" doc:"Requests made today."`
	Remaining int        `json:"remaining" doc:"Requests left today."`
	ResetsAt  *time.Time `json:"resets_at,omitempty" doc:"When the allowance renews."`
}

type KeyedAISettings struct {
	Available  bool     `json:"available" doc:"Whether this node can reach it at all. Off when the node was started with an empty endpoint."`
	Configured bool     `json:"configured" doc:"Whether the user saved a key."`
	Model      string   `json:"model" doc:"The model that answers."`
	Models     []string `json:"models" doc:"The models the user may choose from, the default first."`
}

type OpenAISettings struct {
	Configured bool   `json:"configured" doc:"Whether there is an endpoint and a model to ask."`
	HasKey     bool   `json:"has_key" doc:"Whether the user saved a key. A local server usually needs none."`
	Endpoint   string `json:"endpoint" doc:"The base URL requests go to, such as https://api.openai.com/v1."`
	Model      string `json:"model" doc:"The model to ask, as the endpoint names it."`
}

type AIKeyUpdate struct {
	APIKey *string `json:"api_key,omitempty" maxLength:"1024" doc:"The user's own key. The provider is asked to accept it before it is stored. Empty forgets it; left out keeps the one stored."`
	Model  *string `json:"model,omitempty" maxLength:"200" doc:"The model to answer with. Left out keeps the one chosen."`
}

type OpenAIUpdate struct {
	Endpoint *string `json:"endpoint,omitempty" maxLength:"512" doc:"The base URL, such as https://api.openai.com/v1 or http://localhost:11434/v1. Empty forgets it."`
	APIKey   *string `json:"api_key,omitempty" maxLength:"1024" doc:"The key, if the endpoint wants one. Empty forgets it."`
	Model    *string `json:"model,omitempty" maxLength:"200" doc:"The model, as the endpoint names it."`
}

type AISettingsUpdate struct {
	Provider *string       `json:"provider,omitempty" enum:"cloud,claude,gemini,openai" doc:"The AI to answer with. Choosing one that is not set up yet is allowed; ready says so."`
	Claude   *AIKeyUpdate  `json:"claude,omitempty"`
	Gemini   *AIKeyUpdate  `json:"gemini,omitempty"`
	OpenAI   *OpenAIUpdate `json:"openai,omitempty"`
}

// provider is the user's choice. Before they made one, someone who already
// saved a Claude key keeps Claude; everyone else gets the free AI.
func (s *Service) provider() (string, error) {
	providers := s.opts.AI

	if providers.Store != nil {
		chosen, err := providers.Store.Get(providerEntry)
		if err != nil {
			return "", apperr.Wrap(err, apperr.KindInternal, "read the chosen AI")
		}

		if chosen != "" {
			return chosen, nil
		}
	}

	if providers.Claude != nil {
		key, err := providers.Claude.Keys().Key()
		if err != nil {
			return "", apperr.Wrap(err, apperr.KindInternal, "read claude api key")
		}

		if key != "" {
			return ProviderClaude, nil
		}
	}

	return ProviderCloud, nil
}

func (s *Service) activeAI() (ai.Provider, error) {
	chosen, err := s.provider()
	if err != nil {
		return nil, err
	}

	providers := s.opts.AI

	var provider ai.Provider

	switch chosen {
	case ProviderCloud:
		if providers.Cloud != nil {
			provider = providers.Cloud
		}
	case ProviderClaude:
		if providers.Claude != nil {
			provider = providers.Claude
		}
	case ProviderGemini:
		if providers.Gemini != nil {
			provider = providers.Gemini
		}
	case ProviderOpenAI:
		if providers.OpenAI != nil {
			provider = providers.OpenAI
		}
	}

	if provider == nil {
		return nil, apperr.New(apperr.KindPrecondition, "this AI is turned off on this node: choose another in the settings")
	}

	return provider, nil
}

func (s *Service) AISettings(ctx context.Context) (*AISettings, error) {
	chosen, err := s.provider()
	if err != nil {
		return nil, err
	}

	providers := s.opts.AI
	settings := &AISettings{Provider: chosen}

	if providers.Cloud != nil && providers.Cloud.Linked() {
		settings.Cloud.Linked = true

		quotaCtx, cancel := context.WithTimeout(ctx, quotaTimeout)
		quota, quotaErr := providers.Cloud.AIQuota(quotaCtx)

		cancel()

		if quotaErr == nil {
			settings.Cloud.Known = true
			settings.Cloud.Enabled = quota.Enabled
			settings.Cloud.Limit = quota.Limit
			settings.Cloud.Used = quota.Used
			settings.Cloud.Remaining = quota.Remaining
			settings.Cloud.ResetsAt = &quota.ResetsAt
		}
	}

	settings.Claude = KeyedAISettings{Model: claude.Models[0], Models: claude.Models}
	if providers.Claude != nil {
		if settings.Claude, err = keyedSettings(providers.Claude.Keys(), providers.Claude.Model, claude.Models); err != nil {
			return nil, err
		}
	}

	settings.Gemini = KeyedAISettings{Model: gemini.Models[0], Models: gemini.Models}
	if providers.Gemini != nil {
		if settings.Gemini, err = keyedSettings(providers.Gemini.Keys(), providers.Gemini.Model, gemini.Models); err != nil {
			return nil, err
		}
	}

	if providers.OpenAI != nil {
		if settings.OpenAI, err = openAISettings(providers.OpenAI); err != nil {
			return nil, err
		}
	}

	switch chosen {
	case ProviderCloud:
		cloudAI := settings.Cloud
		settings.Ready = providers.Cloud != nil && cloudAI.Linked &&
			(!cloudAI.Known || (cloudAI.Enabled && cloudAI.Remaining > 0))
	case ProviderClaude:
		settings.Ready = settings.Claude.Available && settings.Claude.Configured
	case ProviderGemini:
		settings.Ready = settings.Gemini.Available && settings.Gemini.Configured
	case ProviderOpenAI:
		settings.Ready = settings.OpenAI.Configured
	}

	return settings, nil
}

func keyedSettings(keys *secrets.APIKey, model func() (string, error), models []string) (KeyedAISettings, error) {
	key, err := keys.Key()
	if err != nil {
		return KeyedAISettings{}, apperr.Wrap(err, apperr.KindInternal, "read an AI api key")
	}

	chosen, err := model()
	if err != nil {
		return KeyedAISettings{}, err
	}

	return KeyedAISettings{Available: true, Configured: key != "", Model: chosen, Models: models}, nil
}

func openAISettings(client *openai.Client) (OpenAISettings, error) {
	configured, err := client.Configured()
	if err != nil {
		return OpenAISettings{}, err
	}

	endpoint, err := client.Endpoint()
	if err != nil {
		return OpenAISettings{}, err
	}

	model, err := client.Model()
	if err != nil {
		return OpenAISettings{}, err
	}

	key, err := client.Keys().Key()
	if err != nil {
		return OpenAISettings{}, apperr.Wrap(err, apperr.KindInternal, "read the AI api key")
	}

	return OpenAISettings{Configured: configured, HasKey: key != "", Endpoint: endpoint, Model: model}, nil
}

// SetAISettings stores the user's choice and each provider's key, after the
// provider has accepted the key. A nil field is left as it is.
func (s *Service) SetAISettings(ctx context.Context, update AISettingsUpdate) (*AISettings, error) {
	providers := s.opts.AI

	if update.Claude != nil {
		if providers.Claude == nil {
			return nil, apperr.New(apperr.KindPrecondition, "Claude is turned off on this node")
		}

		if err := setKeyed(ctx, update.Claude, providers.Claude.SetModel, providers.Claude.Check, providers.Claude.Keys()); err != nil {
			return nil, err
		}
	}

	if update.Gemini != nil {
		if providers.Gemini == nil {
			return nil, apperr.New(apperr.KindPrecondition, "Gemini is turned off on this node")
		}

		if err := setKeyed(ctx, update.Gemini, providers.Gemini.SetModel, providers.Gemini.Check, providers.Gemini.Keys()); err != nil {
			return nil, err
		}
	}

	if update.OpenAI != nil {
		if providers.OpenAI == nil {
			return nil, apperr.New(apperr.KindPrecondition, "custom AI endpoints are turned off on this node")
		}

		if err := setOpenAI(ctx, providers.OpenAI, update.OpenAI); err != nil {
			return nil, err
		}
	}

	if update.Provider != nil {
		if providers.Store == nil {
			return nil, apperr.New(apperr.KindPrecondition, "this node cannot store AI settings")
		}

		if err := providers.Store.Set(providerEntry, *update.Provider); err != nil {
			return nil, apperr.Wrap(err, apperr.KindInternal, "store the chosen AI")
		}
	}

	return s.AISettings(ctx)
}

func setKeyed(
	ctx context.Context,
	update *AIKeyUpdate,
	setModel func(string) error,
	check func(context.Context, string) error,
	keys *secrets.APIKey,
) error {
	if update.Model != nil {
		if err := setModel(*update.Model); err != nil {
			return err
		}
	}

	if update.APIKey == nil {
		return nil
	}

	trimmed := strings.TrimSpace(*update.APIKey)

	if trimmed != "" {
		if err := check(ctx, trimmed); err != nil {
			return err
		}
	}

	if err := keys.SetUserKey(trimmed); err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "store an AI api key")
	}

	return nil
}

// setOpenAI checks the endpoint with the key it will be used with whenever
// either changes, so a typo in the address is caught on save, not on the
// first request.
func setOpenAI(ctx context.Context, client *openai.Client, update *OpenAIUpdate) error {
	endpoint, err := client.Endpoint()
	if err != nil {
		return err
	}

	key, err := client.Keys().Key()
	if err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "read the AI api key")
	}

	if update.Endpoint != nil {
		endpoint = strings.TrimRight(strings.TrimSpace(*update.Endpoint), "/")
	}

	if update.APIKey != nil {
		key = strings.TrimSpace(*update.APIKey)
	}

	if (update.Endpoint != nil || update.APIKey != nil) && endpoint != "" {
		if err := client.Check(ctx, endpoint, key); err != nil {
			return err
		}
	}

	if update.Endpoint != nil {
		if err := client.SetEndpoint(endpoint); err != nil {
			return err
		}
	}

	if update.APIKey != nil {
		if err := client.Keys().SetUserKey(key); err != nil {
			return apperr.Wrap(err, apperr.KindInternal, "store the AI api key")
		}
	}

	if update.Model != nil {
		if err := client.SetModel(*update.Model); err != nil {
			return err
		}
	}

	return nil
}
