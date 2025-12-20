import { useState } from 'react';
import { useCollaborationStore } from '../../store/collaborationStore';
import { useAuthStore } from '../../store/authStore';
import { socketService } from '../../services/socket';
import {
  MessageSquare,
  Send,
  Check,
  Trash2,
  Reply,
  MoreVertical,
} from 'lucide-react';
import { formatRelativeTime } from '../../lib/utils';
import type { Comment } from '@shared/types/collaboration';

interface CommentsPanelProps {
  sessionId: string;
}

export default function CommentsPanel({ sessionId }: CommentsPanelProps) {
  const { comments, userRole } = useCollaborationStore();
  const { user } = useAuthStore();
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    socketService.addComment(sessionId, newComment);
    setNewComment('');
  };

  const handleReply = (parentId: string) => {
    if (!replyContent.trim()) return;
    socketService.addComment(sessionId, replyContent, undefined, parentId);
    setReplyContent('');
    setReplyingTo(null);
  };

  const handleResolve = (commentId: string, resolved: boolean) => {
    socketService.updateComment(sessionId, commentId, undefined, resolved);
  };

  const handleDelete = (commentId: string) => {
    if (confirm('Delete this comment?')) {
      socketService.deleteComment(sessionId, commentId);
    }
  };

  const canModifyComment = (comment: Comment) => {
    return comment.userId === user?.id || userRole === 'OWNER';
  };

  const renderComment = (comment: Comment, isReply = false) => (
    <div
      key={comment.id}
      className={`${isReply ? 'ml-6 mt-2' : 'border-b pb-4'} ${
        comment.resolved ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0"
          style={{ backgroundColor: comment.user.color }}
        >
          {comment.user.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{comment.user.name}</span>
              <span className="text-xs text-muted-foreground">
                {formatRelativeTime(comment.createdAt)}
              </span>
              {comment.resolved && (
                <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                  Resolved
                </span>
              )}
            </div>
            {canModifyComment(comment) && (
              <div className="relative group">
                <button className="p-1 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreVertical size={14} />
                </button>
                <div className="absolute right-0 top-full mt-1 w-32 bg-card border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                  <button
                    onClick={() => handleResolve(comment.id, !comment.resolved)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                  >
                    <Check size={14} />
                    {comment.resolved ? 'Unresolve' : 'Resolve'}
                  </button>
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
          <p className="text-sm mt-1">{comment.content}</p>

          {!isReply && (
            <button
              onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-2"
            >
              <Reply size={12} />
              Reply
            </button>
          )}
        </div>
      </div>

      {/* Reply input */}
      {replyingTo === comment.id && (
        <div className="ml-11 mt-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Write a reply..."
              className="flex-1 px-3 py-1.5 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              onKeyDown={(e) => e.key === 'Enter' && handleReply(comment.id)}
              autoFocus
            />
            <button
              onClick={() => handleReply(comment.id)}
              disabled={!replyContent.trim()}
              className="p-1.5 bg-primary text-primary-foreground rounded-lg disabled:opacity-50"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Replies */}
      {comment.replies?.map(reply => renderComment(reply, true))}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <h3 className="font-medium flex items-center gap-2">
          <MessageSquare size={18} />
          Comments
          {comments.length > 0 && (
            <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
              {comments.length}
            </span>
          )}
        </h3>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {comments.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No comments yet</p>
          </div>
        ) : (
          comments.map(comment => renderComment(comment))
        )}
      </div>

      {/* New comment input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
          />
          <button
            onClick={handleAddComment}
            disabled={!newComment.trim()}
            className="p-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
