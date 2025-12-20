import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Loader2, Users, User } from 'lucide-react';

interface SessionPreview {
  id: string;
  name: string;
  description?: string;
  owner: {
    name: string;
    avatar?: string;
  };
  memberCount: number;
}

export default function JoinSessionPage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, loginAsGuest, isLoading: authLoading } = useAuthStore();
  const [session, setSession] = useState<SessionPreview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSession();
  }, [shareToken]);

  const fetchSession = async () => {
    if (!shareToken) return;

    setIsLoading(true);
    try {
      const response = await api.get<{ data: SessionPreview }>(`/sessions/share/${shareToken}`);
      setSession(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Session not found');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!session) return;

    if (!isAuthenticated) {
      try {
        await loginAsGuest();
      } catch (err) {
        setError('Failed to create guest account');
        return;
      }
    }

    navigate(`/session/${session.id}?shareToken=${shareToken}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-xl font-semibold mb-2">Session Not Found</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-xl border shadow-lg p-6 text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-primary" />
          </div>

          <h1 className="text-xl font-semibold mb-2">Join Collaboration</h1>

          {session && (
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">{session.name}</h2>
              {session.description && (
                <p className="text-muted-foreground mb-4">{session.description}</p>
              )}

              <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <User size={14} />
                  by {session.owner.name}
                </span>
                <span className="flex items-center gap-1">
                  <Users size={14} />
                  {session.memberCount} members
                </span>
              </div>
            </div>
          )}

          <button
            onClick={handleJoin}
            disabled={authLoading}
            className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {authLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {isAuthenticated ? 'Join Session' : 'Join as Guest'}
              </>
            )}
          </button>

          {!isAuthenticated && (
            <p className="text-sm text-muted-foreground mt-4">
              Already have an account?{' '}
              <button
                onClick={() => navigate('/login')}
                className="text-primary hover:underline"
              >
                Login first
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
