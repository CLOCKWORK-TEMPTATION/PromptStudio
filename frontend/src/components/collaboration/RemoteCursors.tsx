import { useCollaborationStore } from '../../store/collaborationStore';
import { useAuthStore } from '../../store/authStore';

interface RemoteCursorsProps {
  containerRef: React.RefObject<HTMLDivElement>;
}

export default function RemoteCursors({ containerRef }: RemoteCursorsProps) {
  const { cursors } = useCollaborationStore();
  const { user } = useAuthStore();

  // Convert Map to array and filter out current user
  const remoteCursors = Array.from(cursors.entries())
    .filter(([userId]) => userId !== user?.id);

  if (remoteCursors.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {remoteCursors.map(([userId, cursor]) => (
        <div
          key={userId}
          className="mouse-cursor"
          style={{
            transform: `translate(${cursor.x}px, ${cursor.y}px)`,
          }}
        >
          {/* Cursor arrow */}
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            style={{ color: cursor.userColor }}
          >
            <path
              d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.48 0 .72-.58.38-.92L6.35 2.86a.5.5 0 0 0-.85.35z"
              fill="currentColor"
            />
          </svg>

          {/* User name label */}
          <div
            className="mouse-cursor-label"
            style={{ backgroundColor: cursor.userColor }}
          >
            {cursor.userName}
          </div>
        </div>
      ))}
    </div>
  );
}
