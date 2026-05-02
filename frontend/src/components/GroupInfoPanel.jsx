import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  X, Crown, User, UserPlus, UserMinus, Trash2, LogOut,
  Shield, Hash, Lock, Search
} from 'lucide-react';

const GroupInfoPanel = ({ channel, onClose, onChannelLeft, onChannelDeleted }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [channelInfo, setChannelInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteResults, setInviteResults] = useState([]);
  const [isInviting, setIsInviting] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    fetchChannelInfo();
  }, [channel.id]);

  useEffect(() => {
    if (!inviteSearch.trim()) { setInviteResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/api/users/search?q=${inviteSearch}`);
        // Filter out already-members
        const memberIds = channelInfo?.members?.map(m => m.user_id) || [];
        setInviteResults(res.data.filter(u => !memberIds.includes(u.id)));
      } catch (err) { console.error(err); }
    }, 300);
    return () => clearTimeout(timer);
  }, [inviteSearch, channelInfo]);

  const fetchChannelInfo = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/channels/${channel.id}/info`);
      setChannelInfo(res.data);
    } catch (err) {
      console.error('Failed to fetch channel info', err);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = channelInfo?.userRole === 'admin';

  const handleLeave = async () => {
    if (!window.confirm('Are you sure you want to leave this channel?')) return;
    try {
      await api.post(`/api/channels/${channel.id}/leave`);
      onChannelLeft(channel.id);
      navigate('/');
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to leave channel');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Permanently delete #${channel.name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/channels/${channel.id}`);
      onChannelDeleted(channel.id);
      navigate('/');
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete channel');
    }
  };

  const handleInvite = async (targetUser) => {
    setActionLoading(`invite-${targetUser.id}`);
    try {
      await api.post(`/api/channels/${channel.id}/invite`, { userId: targetUser.id });
      await fetchChannelInfo();
      setInviteSearch('');
      setInviteResults([]);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to invite user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (memberId) => {
    if (!window.confirm('Remove this member?')) return;
    setActionLoading(`remove-${memberId}`);
    try {
      await api.delete(`/api/channels/${channel.id}/members/${memberId}`);
      await fetchChannelInfo();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove member');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePromote = async (memberId) => {
    if (!window.confirm('Promote this user to admin?')) return;
    setActionLoading(`promote-${memberId}`);
    try {
      await api.put(`/api/channels/${channel.id}/members/${memberId}/promote`);
      await fetchChannelInfo();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to promote member');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <>
      {/* Mobile backdrop */}
      <div 
        className="fixed inset-0 bg-navy-950/80 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-200" 
        onClick={onClose} 
      />

      {/* Panel */}
      <div 
        className="fixed inset-y-0 right-0 z-50 w-80 max-w-[85vw] flex flex-col h-full bg-navy-900 border-l border-white/5 shadow-2xl animate-in slide-in-from-right duration-200 lg:relative lg:w-72 lg:flex-shrink-0 lg:z-auto"
      >
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-navy-950/60 flex-shrink-0">
        <div className="flex items-center min-w-0">
          {channel.is_private
            ? <Lock size={16} className="text-red-400 mr-2 flex-shrink-0" />
            : <Hash size={16} className="text-primary-400 mr-2 flex-shrink-0" />
          }
          <h2 className="text-base font-bold text-white truncate">{channel.name}</h2>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors flex-shrink-0 ml-2">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {/* Channel meta */}
            <div className="p-4 border-b border-white/5">
              <div className="flex items-center space-x-2 mb-1">
                {channel.is_private
                  ? <span className="text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">Private</span>
                  : <span className="text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">Public</span>
                }
                {isAdmin && (
                  <span className="text-xs font-bold text-primary-400 bg-primary-500/10 border border-primary-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">You're Admin</span>
                )}
              </div>
              {channel.description && (
                <p className="text-xs text-gray-400 mt-2">{channel.description}</p>
              )}
            </div>

            {/* Admin: Invite Users */}
            {isAdmin && (
              <div className="p-4 border-b border-white/5">
                <button
                  onClick={() => setIsInviting(!isInviting)}
                  className="w-full flex items-center justify-center text-sm text-white bg-primary-600/20 hover:bg-primary-600/40 border border-primary-500/30 rounded-lg py-2 transition-colors"
                >
                  <UserPlus size={15} className="mr-2" /> Add Members
                </button>
                {isInviting && (
                  <div className="mt-3 animate-fade-in-up">
                    <div className="relative mb-2">
                      <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input
                        type="text"
                        placeholder="Search users..."
                        value={inviteSearch}
                        onChange={e => setInviteSearch(e.target.value)}
                        className="w-full bg-navy-950 border border-white/10 text-white rounded-lg pl-8 pr-3 py-2 text-xs focus:outline-none focus:border-primary-500 transition-all"
                      />
                    </div>
                    <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                      {inviteResults.map(u => (
                        <div key={u.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5">
                          <div className="flex items-center min-w-0">
                            {u.avatar_url
                              ? <img src={u.avatar_url} className="w-5 h-5 rounded-full object-cover mr-2 flex-shrink-0" alt="" />
                              : <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-[9px] font-bold mr-2 flex-shrink-0">{u.username.charAt(0).toUpperCase()}</div>
                            }
                            <span className="text-xs text-gray-200 truncate">{u.username}</span>
                          </div>
                          <button
                            onClick={() => handleInvite(u)}
                            disabled={actionLoading === `invite-${u.id}`}
                            className="text-[10px] text-white bg-primary-500 hover:bg-primary-400 px-2 py-0.5 rounded ml-2 flex-shrink-0 disabled:opacity-50 transition-colors"
                          >
                            {actionLoading === `invite-${u.id}` ? '...' : 'Invite'}
                          </button>
                        </div>
                      ))}
                      {inviteSearch && inviteResults.length === 0 && (
                        <p className="text-xs text-gray-500 italic text-center py-2">No users found</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Members List */}
            <div className="p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Members — {channelInfo?.members?.length || 0}
              </h3>
              <div className="space-y-1">
                {channelInfo?.members?.map(member => {
                  const isMe = member.user_id === user.id;
                  const isMemberAdmin = member.role === 'admin';
                  return (
                    <div key={member.user_id} className={`flex items-center justify-between p-2 rounded-lg ${isMe ? 'bg-white/5' : 'hover:bg-white/5'} group`}>
                      <div className="flex items-center min-w-0">
                        {member.user?.avatar_url
                          ? <img src={member.user.avatar_url} className="w-7 h-7 rounded-full object-cover mr-2 flex-shrink-0" alt="" />
                          : <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0">{member.user?.username?.charAt(0).toUpperCase()}</div>
                        }
                        <div className="min-w-0">
                          <p className="text-sm text-gray-200 truncate leading-tight">
                            {member.user?.username}
                            {isMe && <span className="text-[10px] text-gray-500 ml-1">(you)</span>}
                          </p>
                          {isMemberAdmin && (
                            <p className="text-[10px] text-primary-400 flex items-center mt-0.5">
                              <Crown size={9} className="mr-1" /> Admin
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Admin actions on other members */}
                      {isAdmin && !isMe && (
                        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          {!isMemberAdmin && (
                            <button
                              onClick={() => handlePromote(member.user_id)}
                              disabled={actionLoading === `promote-${member.user_id}`}
                              title="Promote to Admin"
                              className="text-primary-400 hover:text-primary-300 transition-colors p-1 disabled:opacity-50"
                            >
                              <Shield size={13} />
                            </button>
                          )}
                          <button
                            onClick={() => handleRemove(member.user_id)}
                            disabled={actionLoading === `remove-${member.user_id}`}
                            title="Remove member"
                            className="text-red-400 hover:text-red-300 transition-colors p-1 disabled:opacity-50"
                          >
                            <UserMinus size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-white/5 space-y-2 flex-shrink-0 bg-navy-950/30">
        {channelInfo?.created_by !== user.id && (
          <button
            onClick={handleLeave}
            className="w-full flex items-center justify-center text-sm text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500 border border-red-500/20 rounded-lg py-2.5 transition-colors"
          >
            <LogOut size={15} className="mr-2" /> Leave Channel
          </button>
        )}
        {isAdmin && channelInfo?.created_by === user.id && (
          <button
            onClick={handleDelete}
            className="w-full flex items-center justify-center text-sm text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500 border border-red-500/20 rounded-lg py-2.5 transition-colors"
          >
            <Trash2 size={15} className="mr-2" /> Delete Channel
          </button>
        )}
      </div>
    </div>
    </>
  );
};

export default GroupInfoPanel;
