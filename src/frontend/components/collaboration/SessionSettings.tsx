import { useState } from 'react';
import { api } from '../../services/api';
import { socketService } from '../../services/socket';
import type { CollaborationSession, MemberRole } from '@shared/types/collaboration';
import {
  Settings,
  Users,
  UserPlus,
  Trash2,
  Copy,
  Check,
  Crown,
  Edit3,
  Eye,
  Loader2,
} from 'lucide-react';
import { copyToClipboard, generateShareUrl } from '../../lib/utils';

interface SessionSettingsProps {
  session: CollaborationSession;
}

export default function SessionSettings({ session }: SessionSettingsProps) {
  const [name, setName] = useState(session.name);
  const [description, setDescription] = useState(session.description || '');
  const [isActive, setIsActive] = useState(session.isActive);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'EDITOR' | 'VIEWER'>('VIEWER');
  const [isSaving, setIsSaving] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await api.patch(`/sessions/${session.id}`, {
        name,
        description,
        isActive,
      });
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;

    setIsInviting(true);
    setError(null);
    try {
      await api.post(`/sessions/${session.id}/members`, {
        email: inviteEmail,
        role: inviteRole,
      });
      setInviteEmail('');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to invite');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: 'EDITOR' | 'VIEWER') => {
    try {
      await api.patch(`/sessions/${session.id}/members/${memberId}`, { role: newRole });
      socketService.updatePermission(session.id, memberId, newRole);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to update role');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Remove this member?')) return;

    try {
      await api.delete(`/sessions/${session.id}/members/${memberId}`);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to remove member');
    }
  };

  const handleCopyShareLink = async () => {
    const url = generateShareUrl(session.shareToken);
    await copyToClipboard(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getRoleIcon = (role: MemberRole) => {
    switch (role) {
      case 'OWNER':
        return <Crown size={14} className="text-yellow-500" />;
      case 'EDITOR':
        return <Edit3 size={14} className="text-blue-500" />;
      case 'VIEWER':
        return <Eye size={14} className="text-gray-500" />;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <h3 className="font-medium flex items-center gap-2">
          <Settings size={18} />
          Session Settings
        </h3>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Session details */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Details</h4>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm">Active</label>
            <button
              onClick={() => setIsActive(!isActive)}
              className={`w-12 h-6 rounded-full transition-colors ${
                isActive ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  isActive ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Changes
          </button>
        </div>

        {/* Share link */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Share Link</h4>
          <div className="flex gap-2">
            <input
              type="text"
              value={generateShareUrl(session.shareToken)}
              readOnly
              className="flex-1 px-3 py-2 border rounded-lg bg-muted text-sm"
            />
            <button
              onClick={handleCopyShareLink}
              className="px-3 py-2 border rounded-lg hover:bg-muted"
            >
              {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
            </button>
          </div>
        </div>

        {/* Invite member */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <UserPlus size={16} />
            Invite Member
          </h4>
          <div className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Email address"
              className="flex-1 px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'EDITOR' | 'VIEWER')}
              className="px-3 py-2 border rounded-lg bg-background text-sm"
            >
              <option value="VIEWER">Viewer</option>
              <option value="EDITOR">Editor</option>
            </select>
          </div>
          <button
            onClick={handleInvite}
            disabled={!inviteEmail.trim() || isInviting}
            className="w-full py-2 border rounded-lg text-sm font-medium hover:bg-muted disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isInviting && <Loader2 className="w-4 h-4 animate-spin" />}
            Invite
          </button>
        </div>

        {/* Members list */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Users size={16} />
            Members ({session.members.length})
          </h4>
          <div className="space-y-2">
            {session.members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-muted"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                    style={{ backgroundColor: member.user.color }}
                  >
                    {member.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium flex items-center gap-1">
                      {member.user.name}
                      {getRoleIcon(member.role)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {member.user.email}
                    </div>
                  </div>
                </div>
                {member.role !== 'OWNER' && (
                  <div className="flex items-center gap-1">
                    <select
                      value={member.role}
                      onChange={(e) =>
                        handleRoleChange(member.id, e.target.value as 'EDITOR' | 'VIEWER')
                      }
                      className="px-2 py-1 text-xs border rounded bg-background"
                    >
                      <option value="VIEWER">Viewer</option>
                      <option value="EDITOR">Editor</option>
                    </select>
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      className="p-1 text-destructive hover:bg-destructive/10 rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
