import { useEffect, useRef, useCallback, useState } from 'react';
import * as Y from 'yjs';
import { useCollaborationStore } from '../../store/collaborationStore';
import { socketService } from '../../services/socket';
import { debounce, throttle } from '../../lib/utils';

interface CollaborativeEditorProps {
  sessionId: string;
  readOnly?: boolean;
}

export default function CollaborativeEditor({
  sessionId,
  readOnly = false,
}: CollaborativeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { doc, content, isConnected } = useCollaborationStore();
  const [localContent, setLocalContent] = useState(content);
  const isUpdatingRef = useRef(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync local content with store content
  useEffect(() => {
    if (!isUpdatingRef.current) {
      setLocalContent(content);
    }
  }, [content]);

  // Handle text changes
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (readOnly || !doc) return;

      const newContent = e.target.value;
      setLocalContent(newContent);
      isUpdatingRef.current = true;

      // Update CRDT document
      const text = doc.getText('content');
      doc.transact(() => {
        text.delete(0, text.length);
        text.insert(0, newContent);
      });

      // Get update and send to server
      const update = Y.encodeStateAsUpdate(doc);
      socketService.sendEdit(sessionId, update);

      // Send typing indicator
      socketService.sendTypingStart(sessionId);

      // Clear typing after delay
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        socketService.sendTypingStop(sessionId);
      }, 1000);

      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 50);
    },
    [doc, sessionId, readOnly]
  );

  // Handle cursor/selection changes
  const handleSelectionChange = useCallback(
    throttle(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      // Calculate position for cursor visualization
      const textBeforeCursor = textarea.value.substring(0, start);
      const lines = textBeforeCursor.split('\n');
      const currentLineIndex = lines.length - 1;
      const currentLineStart = textBeforeCursor.lastIndexOf('\n') + 1;

      // Rough calculation of cursor position (would need refinement for accurate positioning)
      const lineHeight = 24; // Approximate line height
      const charWidth = 8.4; // Approximate character width

      const x = (start - currentLineStart) * charWidth + 16; // 16px padding
      const y = currentLineIndex * lineHeight + 16;

      socketService.sendCursorMove(
        sessionId,
        x,
        y,
        start !== end ? { start, end } : undefined
      );
    }, 50),
    [sessionId]
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.addEventListener('select', handleSelectionChange);
    textarea.addEventListener('click', handleSelectionChange);
    textarea.addEventListener('keyup', handleSelectionChange);

    return () => {
      textarea.removeEventListener('select', handleSelectionChange);
      textarea.removeEventListener('click', handleSelectionChange);
      textarea.removeEventListener('keyup', handleSelectionChange);
    };
  }, [handleSelectionChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="collaborative-editor h-full">
      <textarea
        ref={textareaRef}
        value={localContent}
        onChange={handleChange}
        readOnly={readOnly}
        placeholder={readOnly ? 'You have read-only access' : 'Start typing your prompt...'}
        className={`w-full h-full p-4 resize-none focus:outline-none bg-background ${
          readOnly ? 'cursor-not-allowed opacity-75' : ''
        }`}
        spellCheck={false}
      />
      {!isConnected && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Reconnecting...</p>
          </div>
        </div>
      )}
    </div>
  );
}
