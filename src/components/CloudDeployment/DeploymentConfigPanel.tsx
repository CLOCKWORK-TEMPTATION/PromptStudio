'use client';

import React from 'react';
import { CloudProvider, DeploymentConfig } from '@/types';
import { Globe, Shield, Webhook, Key, Activity, AlertCircle } from 'lucide-react';

interface DeploymentConfigPanelProps {
  config: DeploymentConfig;
  onChange: (updates: Partial<DeploymentConfig>) => void;
  provider: CloudProvider;
  regions: Array<{ id: string; name: string }>;
}

export function DeploymentConfigPanel({
  config,
  onChange,
  provider,
  regions,
}: DeploymentConfigPanelProps) {
  return (
    <div className="p-4 border-b border-dark-700 bg-dark-800/50 animate-fade-in overflow-y-auto max-h-[400px]">
      {/* Basic Configuration */}
      <div className="mb-6">
        <h4 className="flex items-center gap-2 text-sm font-medium text-white mb-3">
          <Globe className="w-4 h-4 text-primary-400" />
          Basic Configuration
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-dark-400 mb-1.5">Deployment Name</label>
            <input
              type="text"
              value={config.name}
              onChange={(e) => onChange({ name: e.target.value })}
              className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-sm text-white focus:border-primary-500 focus:outline-none"
              placeholder="prompt-api"
            />
          </div>
          <div>
            <label className="block text-xs text-dark-400 mb-1.5">Region</label>
            <select
              value={config.region}
              onChange={(e) => onChange({ region: e.target.value })}
              className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-sm text-white focus:border-primary-500 focus:outline-none"
            >
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-dark-400 mb-1.5">Environment</label>
            <select
              value={config.environment}
              onChange={(e) =>
                onChange({ environment: e.target.value as 'development' | 'staging' | 'production' })
              }
              className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-sm text-white focus:border-primary-500 focus:outline-none"
            >
              <option value="development">Development</option>
              <option value="staging">Staging</option>
              <option value="production">Production</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-dark-400 mb-1.5">Timeout (seconds)</label>
            <input
              type="number"
              value={config.timeout}
              onChange={(e) => onChange({ timeout: parseInt(e.target.value) || 30 })}
              className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-sm text-white focus:border-primary-500 focus:outline-none"
              min={1}
              max={900}
            />
          </div>
          <div>
            <label className="block text-xs text-dark-400 mb-1.5">Memory (MB)</label>
            <select
              value={config.memory}
              onChange={(e) => onChange({ memory: parseInt(e.target.value) })}
              className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-sm text-white focus:border-primary-500 focus:outline-none"
            >
              <option value={128}>128 MB</option>
              <option value={256}>256 MB</option>
              <option value={512}>512 MB</option>
              <option value={1024}>1024 MB</option>
              <option value={2048}>2048 MB</option>
            </select>
          </div>
        </div>
      </div>

      {/* Rate Limiting */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="flex items-center gap-2 text-sm font-medium text-white">
            <Shield className="w-4 h-4 text-green-400" />
            Rate Limiting
          </h4>
          <ToggleSwitch
            checked={config.rateLimit?.enabled ?? false}
            onChange={(enabled) =>
              onChange({
                rateLimit: { ...config.rateLimit!, enabled },
              })
            }
          />
        </div>
        {config.rateLimit?.enabled && (
          <div className="grid grid-cols-2 gap-4 animate-fade-in">
            <div>
              <label className="block text-xs text-dark-400 mb-1.5">Requests/Minute</label>
              <input
                type="number"
                value={config.rateLimit.requestsPerMinute}
                onChange={(e) =>
                  onChange({
                    rateLimit: {
                      ...config.rateLimit!,
                      requestsPerMinute: parseInt(e.target.value) || 60,
                    },
                  })
                }
                className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-sm text-white focus:border-primary-500 focus:outline-none"
                min={1}
              />
            </div>
            <div>
              <label className="block text-xs text-dark-400 mb-1.5">Requests/Hour</label>
              <input
                type="number"
                value={config.rateLimit.requestsPerHour}
                onChange={(e) =>
                  onChange({
                    rateLimit: {
                      ...config.rateLimit!,
                      requestsPerHour: parseInt(e.target.value) || 1000,
                    },
                  })
                }
                className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-sm text-white focus:border-primary-500 focus:outline-none"
                min={1}
              />
            </div>
            <div>
              <label className="block text-xs text-dark-400 mb-1.5">Requests/Day</label>
              <input
                type="number"
                value={config.rateLimit.requestsPerDay}
                onChange={(e) =>
                  onChange({
                    rateLimit: {
                      ...config.rateLimit!,
                      requestsPerDay: parseInt(e.target.value) || 10000,
                    },
                  })
                }
                className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-sm text-white focus:border-primary-500 focus:outline-none"
                min={1}
              />
            </div>
            <div>
              <label className="block text-xs text-dark-400 mb-1.5">Burst Limit</label>
              <input
                type="number"
                value={config.rateLimit.burstLimit}
                onChange={(e) =>
                  onChange({
                    rateLimit: {
                      ...config.rateLimit!,
                      burstLimit: parseInt(e.target.value) || 10,
                    },
                  })
                }
                className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-sm text-white focus:border-primary-500 focus:outline-none"
                min={1}
              />
            </div>
          </div>
        )}
      </div>

      {/* Webhooks */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="flex items-center gap-2 text-sm font-medium text-white">
            <Webhook className="w-4 h-4 text-purple-400" />
            Webhooks
          </h4>
          <ToggleSwitch
            checked={config.webhook?.enabled ?? false}
            onChange={(enabled) =>
              onChange({
                webhook: {
                  enabled,
                  url: config.webhook?.url ?? '',
                  secret: config.webhook?.secret ?? '',
                  events: config.webhook?.events ?? ['request.completed', 'request.failed'],
                  retryOnFailure: config.webhook?.retryOnFailure ?? true,
                  maxRetries: config.webhook?.maxRetries ?? 3,
                },
              })
            }
          />
        </div>
        {config.webhook?.enabled && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <label className="block text-xs text-dark-400 mb-1.5">Webhook URL</label>
              <input
                type="url"
                value={config.webhook.url}
                onChange={(e) =>
                  onChange({
                    webhook: { ...config.webhook!, url: e.target.value },
                  })
                }
                className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-sm text-white focus:border-primary-500 focus:outline-none"
                placeholder="https://your-webhook-endpoint.com/hook"
              />
            </div>
            <div>
              <label className="block text-xs text-dark-400 mb-1.5">Webhook Secret</label>
              <input
                type="password"
                value={config.webhook.secret}
                onChange={(e) =>
                  onChange({
                    webhook: { ...config.webhook!, secret: e.target.value },
                  })
                }
                className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-sm text-white focus:border-primary-500 focus:outline-none"
                placeholder="your-webhook-secret"
              />
            </div>
            <div>
              <label className="block text-xs text-dark-400 mb-2">Events</label>
              <div className="flex flex-wrap gap-2">
                {[
                  'request.started',
                  'request.completed',
                  'request.failed',
                  'rate_limit.exceeded',
                  'error.occurred',
                ].map((event) => (
                  <label
                    key={event}
                    className={`px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                      config.webhook?.events?.includes(event as any)
                        ? 'bg-primary-500/20 text-primary-400 border border-primary-500/50'
                        : 'bg-dark-900 text-dark-400 border border-dark-700 hover:border-dark-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={config.webhook?.events?.includes(event as any)}
                      onChange={(e) => {
                        const events = config.webhook?.events || [];
                        onChange({
                          webhook: {
                            ...config.webhook!,
                            events: e.target.checked
                              ? [...events, event as any]
                              : events.filter((ev) => ev !== event),
                          },
                        });
                      }}
                      className="sr-only"
                    />
                    {event}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* API Keys */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="flex items-center gap-2 text-sm font-medium text-white">
            <Key className="w-4 h-4 text-amber-400" />
            API Key Authentication
          </h4>
          <ToggleSwitch
            checked={config.apiKey?.enabled ?? false}
            onChange={(enabled) =>
              onChange({
                apiKey: {
                  enabled,
                  keys: config.apiKey?.keys ?? [],
                  rotationPolicy: config.apiKey?.rotationPolicy ?? 'manual',
                },
              })
            }
          />
        </div>
        {config.apiKey?.enabled && (
          <div className="p-3 bg-dark-900 rounded-lg border border-dark-700 animate-fade-in">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-dark-400">
                API keys will be configured as environment variables during deployment. You can
                manage them through your cloud provider's dashboard.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleSwitch({ checked, onChange }: ToggleSwitchProps) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors ${
        checked ? 'bg-primary-500' : 'bg-dark-600'
      }`}
    >
      <div
        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
          checked ? 'translate-x-5' : ''
        }`}
      />
    </button>
  );
}
