'use client';

import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  Plus,
  Check,
  Clock,
  User,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';

interface TemplateVersion {
  id: string;
  templateId: string;
  versionNumber: number;
  contentSnapshot: {
    system: string;
    developer?: string;
    user: string;
    context?: string;
  };
  isActive: boolean;
  createdAt: string;
  createdBy?: {
    id: string;
    name: string;
  };
}

interface VersionsPanelProps {
  templateId: string;
  activeVersionId?: string;
  onVersionSelect?: (version: TemplateVersion) => void;
  onVersionActivate?: (versionId: string) => void;
  onCreateVersion?: () => void;
}

export function VersionsPanel({
  templateId,
  activeVersionId,
  onVersionSelect,
  onVersionActivate,
  onCreateVersion,
}: VersionsPanelProps) {
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  // Load versions
  const loadVersions = async () => {
    if (!templateId) return;

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/templates/${templateId}/versions`);
      if (!response.ok) throw new Error('Failed to load versions');
      const data = await response.json();
      setVersions(data.versions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVersions();
  }, [templateId]);

  // Activate version
  const handleActivate = async (versionId: string) => {
    try {
      const response = await fetch(
        `/api/templates/${templateId}/versions/${versionId}/activate`,
        { method: 'POST' }
      );
      if (!response.ok) throw new Error('Failed to activate version');
      loadVersions();
      onVersionActivate?.(versionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate');
    }
  };

  // Select version for preview
  const handleSelect = (version: TemplateVersion) => {
    setSelectedVersionId(version.id);
    onVersionSelect?.(version);
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!templateId) {
    return (
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
        <div className="text-center text-gray-400 py-4">
          Select a template to view versions
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Versions</h3>
        </div>
        <button
          onClick={onCreateVersion}
          className="flex items-center gap-1 px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          <Plus className="w-4 h-4" />
          New Version
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-2 bg-red-900/50 border border-red-700 rounded text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Version List */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {loading ? (
          <div className="text-center py-4 text-gray-400">Loading versions...</div>
        ) : versions.length === 0 ? (
          <div className="text-center py-4 text-gray-400">No versions yet</div>
        ) : (
          versions.map((version) => (
            <div
              key={version.id}
              className={`flex items-center justify-between p-3 rounded border cursor-pointer transition-colors ${
                selectedVersionId === version.id
                  ? 'bg-purple-900/30 border-purple-500'
                  : version.isActive
                  ? 'bg-green-900/20 border-green-700'
                  : 'bg-gray-800 border-gray-700 hover:border-gray-600'
              }`}
              onClick={() => handleSelect(version)}
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="text-lg font-bold text-white">v{version.versionNumber}</span>
                  {version.isActive && (
                    <span className="ml-2 px-2 py-0.5 bg-green-600 text-white text-xs rounded">
                      Active
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right text-xs text-gray-400">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(version.createdAt)}
                  </div>
                  {version.createdBy && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <User className="w-3 h-3" />
                      {version.createdBy.name}
                    </div>
                  )}
                </div>

                {!version.isActive && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleActivate(version.id);
                    }}
                    className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-gray-700 rounded"
                    title="Activate this version"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}

                <ChevronRight className="w-4 h-4 text-gray-500" />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Selected Version Preview */}
      {selectedVersionId && (
        <div className="mt-4 p-3 bg-gray-800 rounded border border-gray-700">
          <h4 className="text-sm font-medium text-gray-300 mb-2">Version Preview</h4>
          {versions
            .filter((v) => v.id === selectedVersionId)
            .map((v) => (
              <div key={v.id} className="space-y-2 text-xs">
                {v.contentSnapshot.system && (
                  <div>
                    <span className="text-gray-500">System:</span>
                    <pre className="mt-1 p-2 bg-gray-700 rounded text-gray-300 overflow-x-auto">
                      {v.contentSnapshot.system.slice(0, 200)}
                      {v.contentSnapshot.system.length > 200 && '...'}
                    </pre>
                  </div>
                )}
                {v.contentSnapshot.user && (
                  <div>
                    <span className="text-gray-500">User:</span>
                    <pre className="mt-1 p-2 bg-gray-700 rounded text-gray-300 overflow-x-auto">
                      {v.contentSnapshot.user.slice(0, 150)}
                      {v.contentSnapshot.user.length > 150 && '...'}
                    </pre>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

export default VersionsPanel;
