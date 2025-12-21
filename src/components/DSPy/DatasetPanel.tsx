'use client';

import React, { useState, useEffect } from 'react';
import {
  Database,
  Plus,
  Trash2,
  RefreshCw,
  Check,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface Dataset {
  id: string;
  name: string;
  description?: string;
  taskType?: string;
  format: 'labeled' | 'unlabeled';
  exampleCount: number;
  createdAt: string;
}

interface DatasetExample {
  id: string;
  inputVariables: Record<string, unknown>;
  expectedOutput?: string;
  metadata?: Record<string, unknown>;
}

interface DatasetPanelProps {
  selectedDatasetId?: string;
  onSelectDataset: (datasetId: string) => void;
  onDatasetChange?: () => void;
}

export function DatasetPanel({
  selectedDatasetId,
  onSelectDataset,
  onDatasetChange,
}: DatasetPanelProps) {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedDataset, setExpandedDataset] = useState<string | null>(null);
  const [examples, setExamples] = useState<DatasetExample[]>([]);
  const [loadingExamples, setLoadingExamples] = useState(false);

  // Create form state
  const [newDataset, setNewDataset] = useState<{
    name: string;
    description: string;
    taskType: string;
    format: 'labeled' | 'unlabeled';
  }>({
    name: '',
    description: '',
    taskType: '',
    format: 'labeled',
  });

  // Load datasets
  const loadDatasets = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/datasets');
      if (!response.ok) throw new Error('Failed to load datasets');
      const data = await response.json();
      setDatasets(data.datasets || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDatasets();
  }, []);

  // Load examples for expanded dataset
  const loadExamples = async (datasetId: string) => {
    try {
      setLoadingExamples(true);
      const response = await fetch(`/api/datasets/${datasetId}/examples?limit=10`);
      if (!response.ok) throw new Error('Failed to load examples');
      const data = await response.json();
      setExamples(data.examples || []);
    } catch (err) {
      console.error('Failed to load examples:', err);
    } finally {
      setLoadingExamples(false);
    }
  };

  // Toggle dataset expansion
  const toggleExpand = (datasetId: string) => {
    if (expandedDataset === datasetId) {
      setExpandedDataset(null);
      setExamples([]);
    } else {
      setExpandedDataset(datasetId);
      loadExamples(datasetId);
    }
  };

  // Create new dataset
  const handleCreateDataset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/datasets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDataset),
      });
      if (!response.ok) throw new Error('Failed to create dataset');
      setShowCreateForm(false);
      setNewDataset({ name: '', description: '', taskType: '', format: 'labeled' });
      loadDatasets();
      onDatasetChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    }
  };

  // Delete dataset
  const handleDeleteDataset = async (datasetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this dataset?')) return;
    try {
      await fetch(`/api/datasets/${datasetId}`, { method: 'DELETE' });
      if (selectedDatasetId === datasetId) {
        onSelectDataset('');
      }
      loadDatasets();
      onDatasetChange?.();
    } catch (err) {
      setError('Failed to delete dataset');
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Datasets</h3>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadDatasets}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            New
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-2 bg-red-900/50 border border-red-700 rounded text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <form onSubmit={handleCreateDataset} className="mb-4 p-3 bg-gray-800 rounded border border-gray-600">
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Dataset name"
              value={newDataset.name}
              onChange={(e) => setNewDataset({ ...newDataset, name: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400"
              required
            />
            <textarea
              placeholder="Description (optional)"
              value={newDataset.description}
              onChange={(e) => setNewDataset({ ...newDataset, description: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400"
              rows={2}
            />
            <div className="flex gap-2">
              <select
                value={newDataset.format}
                onChange={(e) => setNewDataset({ ...newDataset, format: e.target.value as 'labeled' | 'unlabeled' })}
                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
              >
                <option value="labeled">Labeled</option>
                <option value="unlabeled">Unlabeled</option>
              </select>
              <input
                type="text"
                placeholder="Task type"
                value={newDataset.taskType}
                onChange={(e) => setNewDataset({ ...newDataset, taskType: e.target.value })}
                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-3 py-1 text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Create
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Dataset List */}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {loading ? (
          <div className="text-center py-4 text-gray-400">Loading datasets...</div>
        ) : datasets.length === 0 ? (
          <div className="text-center py-4 text-gray-400">
            No datasets yet. Create one to get started.
          </div>
        ) : (
          datasets.map((dataset) => (
            <div key={dataset.id} className="border border-gray-700 rounded overflow-hidden">
              {/* Dataset Row */}
              <div
                className={`flex items-center justify-between p-3 cursor-pointer hover:bg-gray-800 ${
                  selectedDatasetId === dataset.id ? 'bg-blue-900/30 border-l-2 border-l-blue-500' : ''
                }`}
                onClick={() => onSelectDataset(dataset.id)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium text-white truncate">{dataset.name}</div>
                    <div className="text-xs text-gray-400">
                      {dataset.exampleCount} examples
                      {dataset.taskType && ` • ${dataset.taskType}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedDatasetId === dataset.id && (
                    <Check className="w-4 h-4 text-green-400" />
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpand(dataset.id);
                    }}
                    className="p-1 text-gray-400 hover:text-white"
                  >
                    {expandedDataset === dataset.id ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={(e) => handleDeleteDataset(dataset.id, e)}
                    className="p-1 text-gray-400 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Expanded Examples */}
              {expandedDataset === dataset.id && (
                <div className="border-t border-gray-700 p-3 bg-gray-800/50">
                  {loadingExamples ? (
                    <div className="text-center text-gray-400 text-sm">Loading examples...</div>
                  ) : examples.length === 0 ? (
                    <div className="text-center text-gray-400 text-sm">No examples</div>
                  ) : (
                    <div className="space-y-2">
                      {examples.slice(0, 5).map((ex, idx) => (
                        <div key={ex.id} className="text-xs bg-gray-700 rounded p-2">
                          <div className="text-gray-300">
                            <span className="text-gray-500">#{idx + 1}</span>{' '}
                            {JSON.stringify(ex.inputVariables).slice(0, 100)}...
                          </div>
                          {ex.expectedOutput && (
                            <div className="mt-1 text-green-400 truncate">
                              Expected: {ex.expectedOutput.slice(0, 50)}...
                            </div>
                          )}
                        </div>
                      ))}
                      {examples.length > 5 && (
                        <div className="text-center text-gray-400 text-xs">
                          +{examples.length - 5} more examples
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default DatasetPanel;
