import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as Y from 'yjs';
import { useCollaborationStore } from '../store/collaborationStore';
import { useAuthStore } from '../store/authStore';
import { socketService } from '../services/socket';
import { api } from '../services/api';
import CollaborativeEditor from '../components/collaboration/CollaborativeEditor';
import PresenceAvatars from '../components/collaboration/PresenceAvatars';
import RemoteCursors from '../components/collaboration/RemoteCursors';
import CommentsPanel from '../components/collaboration/CommentsPanel';
import HistoryPanel from '../components/collaboration/HistoryPanel';
import SessionSettings from '../components/collaboration/SessionSettings';
import {
  ArrowLeft,
  Share2,
  History,
  MessageSquare,
  Settings,
  Loader2,
  Wifi,
  WifiOff,
  Copy,
  Check,
} from 'lucide-react';
import { copyToClipboard, generateShareUrl } from '../lib/utils';

export default function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    currentSession,
    isConnected,
    isLoading,
    error,
    userRole,
    presence,
    setLoading,
    setError,
    reset,
  } = useCollaborationStore();

  const [activePanel, setActivePanel] = useState<'comments' | 'history' | 'settings' | null>(null);
  const [copied, setCopied] = useState(false);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sessionId) return;

    setLoading(true);
    socketService.connect();
    socketService.joinSession(sessionId);

    return () => {
      if (sessionId) {
        socketService.leaveSession(sessionId);
      }
    };
  }, [sessionId, setLoading]);

  useEffect(() => {
    return () => {
      reset();
      socketService.disconnect();
    };
  }, [reset]);

  const handleShare = async () => {
    if (!currentSession) return;
    const url = generateShareUrl(currentSession.shareToken);
    await copyToClipboard(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const togglePanel = (panel: 'comments' | 'history' | 'settings') => {
    setActivePanel(activePanel === panel ? null : panel);
  };

  if (isLoading && !currentSession) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !currentSession) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <div className="text-destructive text-lg">{error}</div>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="h-14 border-b bg-card flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-medium">{currentSession?.name || 'Loading...'}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {isConnected ? (
                <span className="flex items-center gap-1 text-green-500">
                  <Wifi size={14} />
                  Connected
                </span>
              ) : (
                <span className="flex items-center gap-1 text-destructive">
                  <WifiOff size={14} />
                  Disconnected
                </span>
              )}
              {userRole && (
                <span className="px-2 py-0.5 bg-muted rounded text-xs">
                  {userRole}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Presence avatars */}
          <PresenceAvatars />

          {/* Share button */}
          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-3 py-1.5 border rounded-lg hover:bg-muted transition-colors"
          >
            {copied ? <Check size={16} className="text-green-500" /> : <Share2 size={16} />}
            {copied ? 'Copied!' : 'Share'}
          </button>

          {/* Panel toggles */}
          <div className="flex items-center border rounded-lg">
            <button
              onClick={() => togglePanel('comments')}
              className={`p-2 ${activePanel === 'comments' ? 'bg-muted' : ''}`}
              title="Comments"
            >
              <MessageSquare size={18} />
            </button>
            <button
              onClick={() => togglePanel('history')}
              className={`p-2 ${activePanel === 'history' ? 'bg-muted' : ''}`}
              title="History"
            >
              <History size={18} />
            </button>
            {userRole === 'OWNER' && (
              <button
                onClick={() => togglePanel('settings')}
                className={`p-2 ${activePanel === 'settings' ? 'bg-muted' : ''}`}
                title="Settings"
              >
                <Settings size={18} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor area */}
        <div
          ref={editorContainerRef}
          className="flex-1 relative overflow-hidden"
        >
          <RemoteCursors containerRef={editorContainerRef} />
          <CollaborativeEditor
            sessionId={sessionId!}
            readOnly={userRole === 'VIEWER'}
          />
        </div>

        {/* Side panel */}
        {activePanel && (
          <div className="w-80 border-l bg-card shrink-0 overflow-hidden flex flex-col">
            {activePanel === 'comments' && (
              <CommentsPanel sessionId={sessionId!} />
            )}
            {activePanel === 'history' && (
              <HistoryPanel sessionId={sessionId!} />
            )}
            {activePanel === 'settings' && currentSession && (
              <SessionSettings session={currentSession} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
