'use client';

import React, { useEffect, useState } from 'react';

interface CodePreviewProps {
  code: string;
  language: 'python' | 'typescript';
}

// Simple syntax highlighting without external dependencies
function highlightCode(code: string, language: 'python' | 'typescript'): string {
  // Common patterns for both languages
  const patterns: Array<{ pattern: RegExp; className: string }> = [
    // Comments
    { pattern: /(#.*$|\/\/.*$|\/\*[\s\S]*?\*\/)/gm, className: 'text-dark-500' },
    // Strings
    { pattern: /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g, className: 'text-green-400' },
    // Numbers
    { pattern: /\b(\d+\.?\d*)\b/g, className: 'text-orange-400' },
    // Keywords (Python)
    ...(language === 'python'
      ? [
          {
            pattern:
              /\b(def|class|import|from|return|if|else|elif|for|while|try|except|finally|with|as|async|await|raise|pass|break|continue|None|True|False|and|or|not|in|is|lambda)\b/g,
            className: 'text-purple-400',
          },
        ]
      : []),
    // Keywords (TypeScript)
    ...(language === 'typescript'
      ? [
          {
            pattern:
              /\b(function|class|interface|type|export|import|from|return|if|else|for|while|try|catch|finally|throw|new|const|let|var|async|await|extends|implements|public|private|protected|static|readonly|typeof|instanceof|null|undefined|true|false)\b/g,
            className: 'text-purple-400',
          },
        ]
      : []),
    // Types (TypeScript)
    ...(language === 'typescript'
      ? [
          {
            pattern: /\b(string|number|boolean|void|any|unknown|never|object|Promise|Array|Record|Partial|Required|Pick|Omit)\b/g,
            className: 'text-cyan-400',
          },
        ]
      : []),
    // Types (Python)
    ...(language === 'python'
      ? [
          {
            pattern: /\b(str|int|float|bool|list|dict|tuple|set|List|Dict|Tuple|Set|Optional|Any|Union|Type)\b/g,
            className: 'text-cyan-400',
          },
        ]
      : []),
    // Function/method names
    { pattern: /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=\()/g, className: 'text-blue-400' },
    // Decorators (Python)
    ...(language === 'python' ? [{ pattern: /@[a-zA-Z_][a-zA-Z0-9_]*/g, className: 'text-yellow-400' }] : []),
    // Class names (after class keyword)
    { pattern: /\b(class)\s+([A-Z][a-zA-Z0-9_]*)/g, className: 'text-yellow-300' },
  ];

  let highlighted = escapeHtml(code);

  // This is a simplified highlighter - for production, use a proper library
  patterns.forEach(({ pattern, className }) => {
    highlighted = highlighted.replace(pattern, (match) => {
      return `<span class="${className}">${match}</span>`;
    });
  });

  return highlighted;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

export function CodePreview({ code, language }: CodePreviewProps) {
  const [lineNumbers, setLineNumbers] = useState<number[]>([]);

  useEffect(() => {
    const lines = code.split('\n').length;
    setLineNumbers(Array.from({ length: lines }, (_, i) => i + 1));
  }, [code]);

  return (
    <div className="flex text-sm font-mono bg-dark-950">
      {/* Line numbers */}
      <div className="flex-shrink-0 py-4 pl-4 pr-3 text-right text-dark-500 select-none border-r border-dark-800">
        {lineNumbers.map((num) => (
          <div key={num} className="leading-6">
            {num}
          </div>
        ))}
      </div>

      {/* Code content */}
      <pre className="flex-1 p-4 overflow-x-auto">
        <code className="text-dark-100 leading-6 whitespace-pre">
          {code.split('\n').map((line, index) => (
            <div key={index} className="hover:bg-dark-800/50 -mx-4 px-4">
              {line || ' '}
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
}
