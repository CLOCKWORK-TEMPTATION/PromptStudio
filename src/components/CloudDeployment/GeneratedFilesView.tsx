'use client';

import React, { useState, useCallback } from 'react';
import { FileCode, Copy, Check, Download, Terminal, BookOpen, ChevronRight, Folder, File } from 'lucide-react';

interface GeneratedFilesViewProps {
  files: Record<string, string>;
  readme: string;
  deployCommand: string;
  activeFile: string | null;
  onSelectFile: (file: string | null) => void;
}

export function GeneratedFilesView({
  files,
  readme,
  deployCommand,
  activeFile,
  onSelectFile,
}: GeneratedFilesViewProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [showReadme, setShowReadme] = useState(false);

  const handleCopy = useCallback(async (content: string, key: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  }, []);

  const handleDownloadAll = useCallback(() => {
    // Create a simple text representation of all files
    let content = '';
    Object.entries(files).forEach(([filename, code]) => {
      content += `// ===== ${filename} =====\n\n${code}\n\n`;
    });
    content += `// ===== README.md =====\n\n${readme}`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'deployment-files.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [files, readme]);

  const fileTree = buildFileTree(Object.keys(files));
  const activeContent = activeFile ? files[activeFile] : null;

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* File Tree Sidebar */}
      <div className="w-64 border-r border-dark-700 flex flex-col">
        <div className="p-3 border-b border-dark-700 flex items-center justify-between">
          <span className="text-sm font-medium text-dark-300">Files</span>
          <button
            onClick={handleDownloadAll}
            className="p-1.5 hover:bg-dark-700 rounded text-dark-400 hover:text-white transition-colors"
            title="Download all files"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <FileTreeNode
            node={fileTree}
            depth={0}
            activeFile={activeFile}
            onSelect={onSelectFile}
          />
          {/* README Toggle */}
          <button
            onClick={() => {
              setShowReadme(!showReadme);
              onSelectFile(null);
            }}
            className={`w-full flex items-center gap-2 px-2 py-1.5 mt-2 rounded text-sm transition-colors ${
              showReadme
                ? 'bg-primary-500/20 text-primary-400'
                : 'text-dark-300 hover:bg-dark-700'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>README.md</span>
          </button>
        </div>

        {/* Deploy Command */}
        <div className="p-3 border-t border-dark-700">
          <p className="text-xs text-dark-400 mb-2">Deploy Command:</p>
          <div className="flex items-center gap-2 p-2 bg-dark-900 rounded-lg">
            <Terminal className="w-4 h-4 text-green-400 flex-shrink-0" />
            <code className="flex-1 text-xs text-dark-200 truncate">{deployCommand}</code>
            <button
              onClick={() => handleCopy(deployCommand, 'command')}
              className="flex-shrink-0 p-1 hover:bg-dark-700 rounded transition-colors"
            >
              {copied === 'command' ? (
                <Check className="w-3.5 h-3.5 text-green-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-dark-400" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-dark-950">
        {showReadme ? (
          <>
            <div className="flex items-center justify-between px-4 py-2 bg-dark-800 border-b border-dark-700">
              <div className="flex items-center gap-2 text-sm text-dark-400">
                <BookOpen className="w-4 h-4" />
                <span>README.md</span>
              </div>
              <button
                onClick={() => handleCopy(readme, 'readme')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-700 hover:bg-dark-600 rounded text-sm text-dark-200 transition-colors"
              >
                {copied === 'readme' ? (
                  <>
                    <Check className="w-4 h-4 text-green-400" />
                    <span className="text-green-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <div className="prose prose-invert prose-sm max-w-none">
                <pre className="whitespace-pre-wrap text-sm text-dark-200 font-mono">{readme}</pre>
              </div>
            </div>
          </>
        ) : activeFile && activeContent ? (
          <>
            <div className="flex items-center justify-between px-4 py-2 bg-dark-800 border-b border-dark-700">
              <div className="flex items-center gap-2 text-sm text-dark-400">
                <FileCode className="w-4 h-4" />
                <span>{activeFile}</span>
              </div>
              <button
                onClick={() => handleCopy(activeContent, activeFile)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-700 hover:bg-dark-600 rounded text-sm text-dark-200 transition-colors"
              >
                {copied === activeFile ? (
                  <>
                    <Check className="w-4 h-4 text-green-400" />
                    <span className="text-green-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              <div className="flex text-sm font-mono">
                <div className="flex-shrink-0 py-4 pl-4 pr-3 text-right text-dark-500 select-none border-r border-dark-800">
                  {activeContent.split('\n').map((_, i) => (
                    <div key={i} className="leading-6">
                      {i + 1}
                    </div>
                  ))}
                </div>
                <pre className="flex-1 p-4 overflow-x-auto">
                  <code className="text-dark-100 leading-6 whitespace-pre">
                    {activeContent}
                  </code>
                </pre>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-dark-400">
            <div className="text-center">
              <FileCode className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Select a file to view its contents</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: FileNode[];
}

function buildFileTree(paths: string[]): FileNode {
  const root: FileNode = { name: '', path: '', isDirectory: true, children: [] };

  paths.forEach((path) => {
    const parts = path.split('/');
    let current = root;

    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1;
      const existingChild = current.children.find((c) => c.name === part);

      if (existingChild) {
        current = existingChild;
      } else {
        const newNode: FileNode = {
          name: part,
          path: parts.slice(0, index + 1).join('/'),
          isDirectory: !isLast,
          children: [],
        };
        current.children.push(newNode);
        current = newNode;
      }
    });
  });

  return root;
}

interface FileTreeNodeProps {
  node: FileNode;
  depth: number;
  activeFile: string | null;
  onSelect: (file: string | null) => void;
}

function FileTreeNode({ node, depth, activeFile, onSelect }: FileTreeNodeProps) {
  const [expanded, setExpanded] = useState(true);

  if (node.name === '') {
    return (
      <>
        {node.children.map((child) => (
          <FileTreeNode
            key={child.path}
            node={child}
            depth={depth}
            activeFile={activeFile}
            onSelect={onSelect}
          />
        ))}
      </>
    );
  }

  if (node.isDirectory) {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-sm text-dark-300 hover:bg-dark-700 transition-colors"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <ChevronRight
            className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
          <Folder className="w-4 h-4 text-primary-400" />
          <span>{node.name}</span>
        </button>
        {expanded && (
          <div>
            {node.children.map((child) => (
              <FileTreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                activeFile={activeFile}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isActive = activeFile === node.path;

  return (
    <button
      onClick={() => onSelect(node.path)}
      className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-sm transition-colors ${
        isActive
          ? 'bg-primary-500/20 text-primary-400'
          : 'text-dark-300 hover:bg-dark-700'
      }`}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      <File className="w-4 h-4 text-dark-400" />
      <span>{node.name}</span>
    </button>
  );
}
