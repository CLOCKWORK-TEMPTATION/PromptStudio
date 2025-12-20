import { useCallback, useEffect, useRef, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { useEditorStore } from '../../stores/editorStore';
import { useAppStore } from '../../stores/appStore';
import { analyzePrompt, detectVariables } from '../../services/analysisService';
import clsx from 'clsx';

export function PromptEditor() {
  const { theme } = useAppStore();
  const {
    content,
    setContent,
    setCursorPosition,
    setAnalysis,
    setIsAnalyzing,
    setShowVariableSuggestions,
    setVariableSuggestionPosition,
  } = useEditorStore();

  const editorRef = useRef<unknown>(null);
  const analysisTimeoutRef = useRef<NodeJS.Timeout>();

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;

    editor.onDidChangeCursorPosition((e) => {
      setCursorPosition(e.position.column + (e.position.lineNumber - 1) * 1000);
    });

    editor.addCommand(
      // @ts-expect-error Monaco types
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      () => {
        console.log('Save triggered');
      }
    );
  };

  const handleContentChange = useCallback((value: string | undefined) => {
    if (value === undefined) return;
    setContent(value);

    if (analysisTimeoutRef.current) {
      clearTimeout(analysisTimeoutRef.current);
    }

    setIsAnalyzing(true);
    analysisTimeoutRef.current = setTimeout(() => {
      const result = analyzePrompt(value);
      setAnalysis(result);
      setIsAnalyzing(false);
    }, 500);

    const cursorPos = (editorRef.current as { getPosition?: () => { column: number; lineNumber: number } })?.getPosition?.();
    if (cursorPos) {
      const textBeforeCursor = value.slice(0, value.split('\n').slice(0, cursorPos.lineNumber - 1).join('\n').length + cursorPos.column);
      const lastAtIndex = textBeforeCursor.lastIndexOf('@');
      const lastBraceIndex = textBeforeCursor.lastIndexOf('{{');

      if (lastAtIndex > textBeforeCursor.lastIndexOf(' ') || lastBraceIndex > textBeforeCursor.lastIndexOf(' ')) {
        setShowVariableSuggestions(true);
        setVariableSuggestionPosition({ x: cursorPos.column * 8, y: cursorPos.lineNumber * 20 });
      } else {
        setShowVariableSuggestions(false);
      }
    }
  }, [setContent, setAnalysis, setIsAnalyzing, setShowVariableSuggestions, setVariableSuggestionPosition]);

  useEffect(() => {
    return () => {
      if (analysisTimeoutRef.current) {
        clearTimeout(analysisTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="h-full relative">
      <Editor
        height="100%"
        defaultLanguage="markdown"
        value={content}
        onChange={handleContentChange}
        onMount={handleEditorMount}
        theme={theme === 'dark' ? 'vs-dark' : 'light'}
        options={{
          fontSize: 14,
          fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
          lineNumbers: 'on',
          minimap: { enabled: false },
          wordWrap: 'on',
          padding: { top: 16, bottom: 16 },
          scrollBeyondLastLine: false,
          renderLineHighlight: 'line',
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          smoothScrolling: true,
          tabSize: 2,
          automaticLayout: true,
          bracketPairColorization: { enabled: true },
          guides: { bracketPairs: true },
        }}
      />
      <VariableHighlights content={content} />
    </div>
  );
}

function VariableHighlights({ content }: { content: string }) {
  const variables = detectVariables(content);
  const { theme } = useAppStore();

  if (variables.length === 0) return null;

  return (
    <div className={clsx(
      'absolute bottom-4 right-4 px-3 py-2 rounded-lg text-sm',
      theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-700 shadow-lg'
    )}>
      <span className="font-medium">{variables.length}</span> variable{variables.length !== 1 && 's'} detected
    </div>
  );
}
