import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import {
  Plus,
  Users,
  MessageSquare,
  History,
  Search,
  Loader2,
  Share2,
  MoreVertical,
  Trash2,
  Edit,
} from 'lucide-react';
import { formatRelativeTime, copyToClipboard, generateShareUrl } from '../lib/utils';

interface Session {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  shareToken: string;
  ownerId: string;
  owner: {
    id: string;
    name: string;
    email: string;
    color: string;
  };
  memberCount: number;
  commentCount: number;
  editCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function DashboardPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionDesc, setNewSessionDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      const response = await api.get<{ data: Session[] }>('/sessions');
      setSessions(response.data.data);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createSession = async () => {
    if (!newSessionName.trim()) return;

    setIsCreating(true);
    try {
      const response = await api.post<{ data: Session }>('/sessions', {
        name: newSessionName,
        description: newSessionDesc,
      });
      setShowCreateModal(false);
      setNewSessionName('');
      setNewSessionDesc('');
      navigate(`/session/${response.data.data.id}`);
    } catch (error) {
      console.error('Failed to create session:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const deleteSession = async (id: string) => {
    if (!confirm('Are you sure you want to delete this session?')) return;

    try {
      await api.delete(`/sessions/${id}`);
      setSessions(sessions.filter(s => s.id !== id));
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const handleShare = async (shareToken: string) => {
    const url = generateShareUrl(shareToken);
    await copyToClipboard(url);
    alert('Share link copied to clipboard!');
  };

  const filteredSessions = sessions.filter(session =>
    session.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold">Collaboration Sessions</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage your collaborative prompt sessions
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={20} />
          New Session
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search sessions..."
          className="w-full pl-10 pr-4 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Sessions Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-medium mb-1">No sessions yet</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Create your first collaboration session to get started
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90"
          >
            <Plus size={20} />
            Create Session
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSessions.map(session => (
            <div
              key={session.id}
              className="bg-card border rounded-xl p-4 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-start justify-between mb-3">
                <Link to={`/session/${session.id}`} className="flex-1 min-w-0">
                  <h3 className="font-medium truncate group-hover:text-primary transition-colors">
                    {session.name}
                  </h3>
                  {session.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {session.description}
                    </p>
                  )}
                </Link>
                <div className="relative group/menu">
                  <button className="p-1 rounded hover:bg-muted">
                    <MoreVertical size={16} />
                  </button>
                  <div className="absolute right-0 top-full mt-1 w-36 bg-card border rounded-lg shadow-lg opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-10">
                    <button
                      onClick={() => handleShare(session.shareToken)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                    >
                      <Share2 size={14} />
                      Share
                    </button>
                    {session.ownerId === user?.id && (
                      <button
                        onClick={() => deleteSession(session.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                <span className="flex items-center gap-1">
                  <Users size={14} />
                  {session.memberCount}
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare size={14} />
                  {session.commentCount}
                </span>
                <span className="flex items-center gap-1">
                  <History size={14} />
                  {session.editCount}
                </span>
              </div>

              <div className="flex items-center justify-between pt-3 border-t">
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white font-medium"
                    style={{ backgroundColor: session.owner.color }}
                  >
                    {session.owner.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {session.owner.name}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatRelativeTime(session.updatedAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl border shadow-lg w-full max-w-md p-6 animate-slide-in">
            <h2 className="text-xl font-semibold mb-4">Create New Session</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Session Name
                </label>
                <input
                  type="text"
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  placeholder="My Awesome Prompt"
                  className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={newSessionDesc}
                  onChange={(e) => setNewSessionDesc(e.target.value)}
                  placeholder="Describe what this session is about..."
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-lg hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createSession}
                disabled={!newSessionName.trim() || isCreating}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
