import { useCollaborationStore } from '../../store/collaborationStore';
import { useAuthStore } from '../../store/authStore';

export default function PresenceAvatars() {
  const { presence, typingUsers } = useCollaborationStore();
  const { user } = useAuthStore();

  // Filter out current user and show max 5 avatars
  const otherUsers = presence.filter(p => p.userId !== user?.id && p.isActive);
  const displayUsers = otherUsers.slice(0, 5);
  const remainingCount = otherUsers.length - 5;

  if (otherUsers.length === 0) {
    return (
      <div className="text-sm text-muted-foreground px-2">
        Only you
      </div>
    );
  }

  return (
    <div className="flex items-center -space-x-2">
      {displayUsers.map((p) => (
        <div
          key={p.userId}
          className="relative group"
        >
          <div
            className="w-8 h-8 rounded-full border-2 border-background flex items-center justify-center text-white text-sm font-medium"
            style={{ backgroundColor: p.user.color }}
            title={p.user.name}
          >
            {p.user.name.charAt(0).toUpperCase()}
          </div>

          {/* Typing indicator */}
          {typingUsers.has(p.userId) && (
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
              <div className="flex gap-0.5">
                <span className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          {/* Tooltip */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-card border rounded shadow-lg text-xs whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
            {p.user.name}
            {typingUsers.has(p.userId) && (
              <span className="text-muted-foreground ml-1">typing...</span>
            )}
          </div>
        </div>
      ))}

      {remainingCount > 0 && (
        <div className="w-8 h-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs font-medium">
          +{remainingCount}
        </div>
      )}
    </div>
  );
}
