import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
  Hash, User, LogOut, PlusCircle, Circle, Settings,
  ShieldAlert, Lock, MessageSquare, Search, X, Globe, ArrowLeft
} from 'lucide-react';
import SettingsModal from './SettingsModal';

const Sidebar = ({ setActiveChannel, setActiveUser, onChannelDeleted }) => {
  const { channelId, userId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const socket = useSocket();

  // Channels the user has joined
  const [channels, setChannels] = useState([]);
  // Public channels available to discover
  const [publicChannels, setPublicChannels] = useState([]);
  // Recent DM conversations
  const [conversations, setConversations] = useState([]);
  // Online user IDs from socket
  const [activeUserIds, setActiveUserIds] = useState([]);

  // UI states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [isDiscoverOpen, setIsDiscoverOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [isPrivateChannel, setIsPrivateChannel] = useState(false);
  const [channelSearch, setChannelSearch] = useState('');

  // DM search
  const [dmSearch, setDmSearch] = useState('');
  const [dmSearchResults, setDmSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [requests, setRequests] = useState([]);

  const [initialDataLoaded, setInitialDataLoaded] = useState(false);

  const fetchChannels = useCallback(async () => {
    try {
      const res = await api.get('/channels');
      setChannels(res.data);
      return res.data;
    } catch (err) {
      console.error('Failed to fetch channels', err);
      return [];
    }
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await api.get('/users/conversations');
      setConversations(res.data);
      return res.data;
    } catch (err) {
      console.error('Failed to fetch conversations', err);
      return [];
    }
  }, []);

  const fetchPublicChannels = useCallback(async () => {
    try {
      const res = await api.get('/channels/public');
      setPublicChannels(res.data);
    } catch (err) {
      console.error('Failed to fetch public channels', err);
    }
  }, []);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await api.get('/requests');
      setRequests(res.data);
    } catch (err) {
      console.error('Failed to fetch requests', err);
    }
  }, []);

  useEffect(() => {
    const loadAll = async () => {
      const [chans, convs] = await Promise.all([fetchChannels(), fetchConversations(), fetchRequests()]);
      
      // Auto-select logic on first load
      if (!sessionStorage.getItem('talkify_auto_selected')) {
        sessionStorage.setItem('talkify_auto_selected', 'true');
        if (!channelId && !userId) {
          if (convs && convs.length > 0) {
            const other = convs[0].user1_id === user.id ? convs[0].user2 : convs[0].user1;
            if (other) navigate(`/chat/${other.id}`, { replace: true });
          } else if (chans && chans.length > 0) {
            navigate(`/channel/${chans[0].id}`, { replace: true });
          }
        }
      }
      setInitialDataLoaded(true);
    };
    loadAll();
  }, [fetchChannels, fetchConversations, fetchRequests, channelId, userId, navigate, user.id]);

  // Event listeners from Dashboard
  useEffect(() => {
    const handleOpenDiscover = () => { setIsDiscoverOpen(true); fetchPublicChannels(); };
    const handleFocusSearch = () => { document.getElementById('dm-search-input')?.focus(); };
    
    window.addEventListener('open-discover', handleOpenDiscover);
    window.addEventListener('focus-search', handleFocusSearch);
    return () => {
      window.removeEventListener('open-discover', handleOpenDiscover);
      window.removeEventListener('focus-search', handleFocusSearch);
    };
  }, [fetchPublicChannels]);

  // Socket listeners for online status
  useEffect(() => {
    if (!socket) return;
    socket.on('active_users', (userIds) => setActiveUserIds(userIds));
    socket.on('user_status_change', ({ userId: uid, is_online }) => {
      setConversations(prev => prev.map(c => {
        if (c.user1?.id === uid) return { ...c, user1: { ...c.user1, is_online } };
        if (c.user2?.id === uid) return { ...c, user2: { ...c.user2, is_online } };
        return c;
      }));
    });
    
    // Listen for new messages to update the conversations list automatically
    socket.on('new_private_message', () => {
      fetchConversations();
    });

    socket.on('new_request', () => {
      fetchRequests();
    });

    return () => {
      socket.off('active_users');
      socket.off('user_status_change');
      socket.off('new_private_message');
      socket.off('new_request');
    };
  }, [socket, fetchConversations, fetchRequests]);

  // Sync active items from URL params
  useEffect(() => {
    if (channelId && channels.length > 0) {
      const ch = channels.find(c => c.id === channelId);
      if (ch) { setActiveChannel(ch); setActiveUser(null); }
    } else if (userId && conversations.length > 0) {
      const conv = conversations.find(c => c.user1_id === userId || c.user2_id === userId);
      if (conv) {
        const otherUser = conv.user1_id === user.id ? conv.user2 : conv.user1;
        setActiveUser(otherUser);
        setActiveChannel(null);
      }
    } else if (!channelId && !userId) {
      setActiveChannel(null);
      setActiveUser(null);
    }
  }, [channelId, userId, channels, conversations]);

  // DM search
  useEffect(() => {
    if (!dmSearch.trim()) {
      setDmSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await api.get(`/users/search?q=${dmSearch}`);
        setDmSearchResults(res.data);
      } catch (err) {
        console.error('Search failed', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [dmSearch]);

  const handleStartChat = async (targetUser) => {
    try {
      await api.post('/users/conversations', { userId: targetUser.id });
      await fetchConversations();
      setDmSearch('');
      setDmSearchResults([]);
      navigate(`/chat/${targetUser.id}`);
    } catch (err) {
      console.error('Failed to start chat', err);
    }
  };

  const handleCreateChannel = async (e) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    try {
      const res = await api.post('/channels', {
        name: newChannelName,
        is_private: isPrivateChannel
      });
      setChannels(prev => [...prev, res.data]);
      setNewChannelName('');
      setIsPrivateChannel(false);
      setIsCreatingChannel(false);
      navigate(`/channel/${res.data.id}`);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create channel');
    }
  };

  const handleJoinPublicChannel = async (channel) => {
    try {
      const res = await api.post(`/channels/${channel.id}/join`);
      setChannels(prev => [...prev, res.data]);
      setPublicChannels(prev => prev.filter(c => c.id !== channel.id));
      setIsDiscoverOpen(false);
      navigate(`/channel/${channel.id}`);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to join channel');
    }
  };

  // Get the "other user" from a conversation
  const getOtherUser = (conv) =>
    conv.user1_id === user.id ? conv.user2 : conv.user1;

  const filteredChannels = channels.filter(c =>
    !channelSearch || c.name.toLowerCase().includes(channelSearch.toLowerCase())
  );

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear();
    
    if (isYesterday) return 'Yesterday';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex flex-col h-full bg-navy-900 text-gray-300 border-r border-white/5 shadow-2xl z-20">
      {/* Header */}
      <div className="p-5 border-b border-white/5 flex items-center justify-between backdrop-blur-md bg-navy-950/40 flex-shrink-0">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-500/30">
            <MessageSquare size={16} className="text-white" />
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 tracking-tight">Talkify</h1>
        </div>
        <div className="flex items-center space-x-3">
          {user?.role === 'admin' && (
            <button onClick={() => navigate('/admin')} className="text-primary-400 hover:text-primary-300 transition-all hover:scale-110" title="Admin Dashboard">
              <ShieldAlert size={18} />
            </button>
          )}
          <button onClick={logout} className="text-gray-500 hover:text-red-400 transition-all hover:scale-110" title="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 custom-scrollbar">
        {/* Message Requests Section */}
        {requests.length > 0 && (
          <div className="mb-6">
            <div className="px-4 mb-2 flex items-center justify-between">
              <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center">
                <span className="w-2 h-2 rounded-full bg-orange-500 mr-2 animate-pulse" />
                Message Requests
              </h3>
              <span className="bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {requests.length}
              </span>
            </div>
            <div className="px-2 space-y-0.5">
              {requests.map(req => {
                const other = req.sender;
                if (!other) return null;
                const isActive = userId === other.id;
                return (
                  <button
                    key={req.id}
                    onClick={() => navigate(`/chat/${other.id}`)}
                    className={`w-full flex items-center px-3 py-2.5 rounded-lg transition-all duration-150 group ${
                      isActive
                        ? 'bg-white/10 border border-white/5'
                        : 'hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <div className="relative mr-3 flex-shrink-0">
                      {other.avatar_url
                        ? <img src={other.avatar_url} className="w-10 h-10 sm:w-9 sm:h-9 rounded-full object-cover shadow-sm" alt="" />
                        : <div className="w-10 h-10 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold shadow-sm">{other.username.charAt(0).toUpperCase()}</div>
                      }
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <span className={`truncate text-[15px] sm:text-sm font-semibold ${isActive ? 'text-white' : 'text-gray-200 group-hover:text-white'}`}>
                        {other.username}
                      </span>
                      <p className="text-[13px] sm:text-xs truncate mt-0.5 text-orange-400 font-medium">Wants to message you</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── CHANNELS ── */}
        <div className="px-3 mb-5">
          <div className="flex items-center justify-between mb-2 px-2 group">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Channels</h2>
            <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => { setIsDiscoverOpen(true); fetchPublicChannels(); }} className="text-gray-500 hover:text-blue-400 transition-colors" title="Discover public channels">
                <Globe size={15} />
              </button>
              <button onClick={() => setIsCreatingChannel(!isCreatingChannel)} className="text-gray-500 hover:text-white transition-colors" title="Create channel">
                <PlusCircle size={15} />
              </button>
            </div>
          </div>

          {/* Channel Search */}
          {channels.length > 3 && (
            <div className="relative mb-2 px-2">
              <Search size={12} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Filter channels..."
                value={channelSearch}
                onChange={e => setChannelSearch(e.target.value)}
                className="w-full bg-navy-950/50 border border-white/10 text-white rounded-lg pl-7 pr-3 py-1 text-xs focus:outline-none focus:border-primary-500 transition-all"
              />
            </div>
          )}

          {/* Create Channel Form */}
          {isCreatingChannel && (
            <form onSubmit={handleCreateChannel} className="mb-3 px-2 animate-fade-in-up">
              <input
                type="text"
                placeholder="channel-name"
                value={newChannelName}
                onChange={e => setNewChannelName(e.target.value)}
                autoFocus
                className="w-full bg-navy-950/50 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500 mb-2 transition-all shadow-inner"
              />
              <label className="flex items-center text-xs text-gray-400 mb-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPrivateChannel}
                  onChange={e => setIsPrivateChannel(e.target.checked)}
                  className="mr-2"
                />
                Private Channel
              </label>
              <div className="flex space-x-2">
                <button type="button" onClick={() => setIsCreatingChannel(false)} className="flex-1 py-1.5 text-xs text-gray-400 bg-white/5 rounded hover:bg-white/10 transition">Cancel</button>
                <button type="submit" className="flex-1 py-1.5 text-xs text-white bg-primary-600 rounded hover:bg-primary-500 transition">Create</button>
              </div>
            </form>
          )}

          {/* Channel List */}
          <div className="space-y-0.5">
            {filteredChannels.length === 0 && !isCreatingChannel && (
              <p className="text-xs text-gray-600 px-2 py-1 italic">No channels yet. Create or discover one!</p>
            )}
            {filteredChannels.map(channel => {
              const isActive = channelId === channel.id;
              const isAdmin = channel.userRole === 'admin';
              return (
                <button
                  key={channel.id}
                  onClick={() => navigate(`/channel/${channel.id}`)}
                  className={`w-full flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group ${
                    isActive
                      ? 'bg-primary-600/20 text-primary-100 border border-primary-500/30'
                      : 'text-gray-400 hover:bg-white/5 hover:text-gray-200 border border-transparent'
                  }`}
                >
                  {channel.is_private
                    ? <Lock size={15} className={`mr-2 flex-shrink-0 ${isActive ? 'text-primary-400' : 'opacity-60'}`} />
                    : <Hash size={15} className={`mr-2 flex-shrink-0 ${isActive ? 'text-primary-400' : 'opacity-60'}`} />
                  }
                  <span className="truncate flex-1 text-left">{channel.name}</span>
                  {isAdmin && (
                    <span className="text-[9px] font-bold text-primary-400/70 uppercase tracking-wider ml-1 flex-shrink-0">Admin</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── DIRECT MESSAGES ── */}
        <div className="px-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">Direct Messages</h2>

          {/* DM Search */}
          <div className="relative mb-2 px-2">
            <Search size={12} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              id="dm-search-input"
              type="text"
              placeholder="Search users to message..."
              value={dmSearch}
              onChange={e => setDmSearch(e.target.value)}
              className="w-full bg-navy-950/50 border border-white/10 text-white rounded-lg pl-7 pr-3 py-1.5 text-xs focus:outline-none focus:border-primary-500 transition-all"
            />
            {dmSearch && (
              <button onClick={() => { setDmSearch(''); setDmSearchResults([]); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                <X size={12} />
              </button>
            )}
          </div>

          {/* Search Results */}
          {dmSearch.trim() && (
            <div className="space-y-0.5 mb-3 px-2">
              {isSearching && <p className="text-xs text-gray-500 italic py-1">Searching...</p>}
              {!isSearching && dmSearchResults.length === 0 && (
                <p className="text-xs text-gray-600 italic py-1">No users found</p>
              )}
              {dmSearchResults.map(u => (
                <div key={u.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-white/5 group">
                  <div className="flex items-center min-w-0">
                    {u.avatar_url
                      ? <img src={u.avatar_url} className="w-5 h-5 rounded-full object-cover mr-2 flex-shrink-0" alt="" />
                      : <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-[10px] mr-2 flex-shrink-0">{u.username.charAt(0).toUpperCase()}</div>
                    }
                    <span className="text-xs text-gray-300 truncate">{u.username}</span>
                  </div>
                  <button
                    onClick={() => handleStartChat(u)}
                    className="text-[10px] text-primary-400 hover:text-white bg-primary-500/10 hover:bg-primary-500 px-2 py-0.5 rounded transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 ml-2"
                  >
                    Chat
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Recent Conversations */}
          {!dmSearch.trim() && (
            <div className="space-y-0.5">
              {conversations.length === 0 && (
                <p className="text-xs text-gray-600 px-2 py-1 italic">No recent chats. Search a user to start!</p>
              )}
              {conversations.map(conv => {
                const other = getOtherUser(conv);
                if (!other) return null;
                const isActive = userId === other.id;
                const isOnline = activeUserIds.includes(other.id) || other.is_online;
                return (
                  <button
                    key={conv.id}
                    onClick={() => navigate(`/chat/${other.id}`)}
                    className={`w-full flex items-center px-3 py-2.5 rounded-lg transition-all duration-150 group ${
                      isActive
                        ? 'bg-white/10 border border-white/5'
                        : 'hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <div className="relative mr-3 flex-shrink-0">
                      {other.avatar_url
                        ? <img src={other.avatar_url} className="w-10 h-10 sm:w-9 sm:h-9 rounded-full object-cover shadow-sm" alt="" />
                        : <div className="w-10 h-10 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold shadow-sm">{other.username.charAt(0).toUpperCase()}</div>
                      }
                      {isOnline && (
                        <Circle size={10} className="absolute -bottom-0.5 -right-0.5 text-green-500 fill-current border-2 border-navy-900 rounded-full" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between">
                        <span className={`truncate text-[15px] sm:text-sm font-semibold ${isActive ? 'text-white' : 'text-gray-200 group-hover:text-white'}`}>
                          {other.username}
                        </span>
                        {conv.lastMessage && (
                          <span className="text-[10px] sm:text-[11px] text-gray-500 ml-2 flex-shrink-0">
                            {formatTime(conv.lastMessage.created_at)}
                          </span>
                        )}
                      </div>
                      {conv.lastMessage ? (
                        <p className={`text-[13px] sm:text-xs truncate mt-0.5 ${isActive ? 'text-gray-300' : 'text-gray-500'}`}>
                          {conv.lastMessage.content || '📎 File attached'}
                        </p>
                      ) : (
                        <p className="text-[13px] sm:text-xs truncate mt-0.5 text-gray-600 italic">No messages yet</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Current User Banner */}
      <div
        className="p-4 bg-navy-950/80 backdrop-blur-md flex items-center cursor-pointer hover:bg-navy-950 transition-all border-t border-white/5 group flex-shrink-0"
        onClick={() => setIsSettingsOpen(true)}
      >
        {user?.avatar_url
          ? <img src={user.avatar_url} alt="avatar" className="w-9 h-9 rounded-full object-cover mr-3 flex-shrink-0 border border-white/10 group-hover:border-primary-500 transition-colors" />
          : <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold mr-3 flex-shrink-0">{user?.username?.charAt(0).toUpperCase()}</div>
        }
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-200 truncate group-hover:text-white">{user?.username}</p>
          <p className="text-xs text-gray-500 flex items-center mt-0.5">
            <Circle size={7} className="text-green-500 fill-current mr-1" /> Online
          </p>
        </div>
        <Settings size={17} className="text-gray-500 group-hover:text-white group-hover:rotate-90 transition-all duration-300" />
      </div>

      {/* Discover Channels Modal */}
      {isDiscoverOpen && (
        <div className="fixed inset-0 bg-navy-950/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-navy-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-navy-950/50">
              <h3 className="text-base font-bold text-white flex items-center"><Globe size={16} className="mr-2 text-blue-400" /> Discover Channels</h3>
              <button onClick={() => setIsDiscoverOpen(false)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-3 max-h-80 overflow-y-auto custom-scrollbar">
              {publicChannels.length === 0
                ? <p className="text-sm text-gray-500 text-center py-4 italic">No public channels to discover!</p>
                : publicChannels.map(ch => (
                  <div key={ch.id} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-white/5 group">
                    <div className="flex items-center">
                      <Hash size={16} className="text-primary-400 mr-2" />
                      <span className="text-sm text-gray-200">{ch.name}</span>
                    </div>
                    <button
                      onClick={() => handleJoinPublicChannel(ch)}
                      className="text-xs text-white bg-primary-600 hover:bg-primary-500 px-3 py-1 rounded transition-colors"
                    >
                      Join
                    </button>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
};

export default Sidebar;
