import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import MessageInput from './MessageInput';
import GroupInfoPanel from './GroupInfoPanel';
import {
  Menu, Hash, User, FileText, Download, ExternalLink,
  Trash2, Copy, Edit2, Check, ArrowLeft, Info, Lock
} from 'lucide-react';
import moment from 'moment';

const ChatWindow = ({ activeChannel, activeUser, onMenuClick, onBackClick, onChannelLeft, onChannelDeleted, onRefreshSidebar }) => {
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  
  const [requestStatus, setRequestStatus] = useState(null); // 'none', 'pending', 'accepted', 'rejected'
  const [requestId, setRequestId] = useState(null);
  const [isRequestSender, setIsRequestSender] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  const { user } = useAuth();
  const socket = useSocket();
  const messagesEndRef = useRef(null);

  const isMember = activeChannel
    ? activeChannel.members?.some(m => m.user_id === user?.id)
    : true;

  const fetchMessages = useCallback(async () => {
    if (!isMember && activeChannel) { setMessages([]); return; }
    try {
      let url = '/api/messages?';
      if (activeChannel) url += `channelId=${activeChannel.id}`;
      else if (activeUser) url += `receiverId=${activeUser.id}`;
      console.log(`Fetching messages from: ${url}`);
      const res = await api.get(url);
      setMessages(res.data);
    } catch (error) {
      if (error.response?.status !== 403) {
        console.error('Failed to fetch messages', error);
      }
    }
  }, [activeChannel, activeUser, isMember]);

  const fetchRequestStatus = useCallback(async () => {
    if (!activeUser) return;
    try {
      const res = await api.get(`/api/requests/status/${activeUser.id}`);
      setRequestStatus(res.data.status);
      setRequestId(res.data.requestId);
      setIsRequestSender(res.data.isSender);
    } catch (err) {
      console.error('Failed to fetch request status', err);
    }
  }, [activeUser]);

  useEffect(() => {
    setMessages([]);
    setIsInfoOpen(false);
    setRequestStatus(null);
    if (activeUser) {
      fetchRequestStatus();
    }
    fetchMessages();
  }, [activeChannel?.id, activeUser?.id, fetchMessages, fetchRequestStatus]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message) => {
      console.log('Received message via socket:', message);
      
      const isRelevant = (activeChannel && message.channel_id === activeChannel.id) || 
                        (activeUser && (
                          (message.sender_id === activeUser.id && message.receiver_id === user.id) ||
                          (message.sender_id === user.id && message.receiver_id === activeUser.id)
                        ));

      if (isRelevant) {
        setMessages(prev => {
          // Prevent duplicates (e.g. from optimistic update + socket event)
          const exists = prev.find(m => m.id === message.id);
          if (exists) return prev;
          return [...prev, message];
        });
      }
    };
    const handleDeleteMessage = ({ messageId }) => {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    };
    const handleEditMessage = (updated) => {
      setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
    };
    const handleTyping = ({ username }) => {
      setTypingUsers(prev => [...new Set([...prev, username])]);
    };
    const handleStopTyping = () => setTypingUsers([]);

    const handleNewRequest = (request) => {
      if (activeUser && request.sender_id === activeUser.id) {
        fetchRequestStatus();
      }
    };
    const handleRequestAccepted = ({ receiverId }) => {
      if (activeUser && receiverId === activeUser.id) {
        fetchRequestStatus();
      }
    };

    socket.on('new_message', handleNewMessage);
    socket.on('delete_message', handleDeleteMessage);
    socket.on('edit_message', handleEditMessage);
    socket.on('user_typing', handleTyping);
    socket.on('user_stop_typing', handleStopTyping);
    socket.on('new_request', handleNewRequest);
    socket.on('request_accepted', handleRequestAccepted);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('delete_message', handleDeleteMessage);
      socket.off('edit_message', handleEditMessage);
      socket.off('user_typing', handleTyping);
      socket.off('user_stop_typing', handleStopTyping);
      socket.off('new_request', handleNewRequest);
      socket.off('request_accepted', handleRequestAccepted);
    };
  }, [socket, activeChannel, activeUser, user, fetchRequestStatus]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  const handleJoinChannel = async () => {
    setIsJoining(true);
    try {
      const res = await api.post(`/api/channels/${activeChannel.id}/join`);
      onRefreshSidebar?.();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to join channel');
    } finally {
      setIsJoining(false);
    }
  };

  const handleSendRequest = async () => {
    setIsRequesting(true);
    try {
      const res = await api.post('/api/requests', { receiverId: activeUser.id });
      setRequestStatus('pending');
      setRequestId(res.data.id);
      setIsRequestSender(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send request');
    } finally {
      setIsRequesting(false);
    }
  };

  const handleCancelRequest = async () => {
    setIsRequesting(true);
    try {
      await api.delete(`/api/requests/${requestId}`);
      setRequestStatus('none');
      setRequestId(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel request');
    } finally {
      setIsRequesting(false);
    }
  };

  const handleRespondRequest = async (action) => {
    setIsRequesting(true);
    try {
      await api.put(`/api/requests/${requestId}`, { action });
      if (action === 'accept') {
        setRequestStatus('accepted');
        onRefreshSidebar?.();
      } else {
        setRequestStatus('rejected');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to respond to request');
    } finally {
      setIsRequesting(false);
    }
  };

  const handleSendMessage = async (content, file) => {
    const formData = new FormData();
    if (content) formData.append('content', content);
    if (activeChannel) formData.append('channelId', activeChannel.id);
    if (activeUser) formData.append('receiverId', activeUser.id);
    if (file) formData.append('file', file);
    try {
      console.log('Sending message...', { content, channelId: activeChannel?.id, receiverId: activeUser?.id });
      const res = await api.post('/api/messages', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      
      // Optimistic Update: Immediately add the response to UI
      setMessages(prev => {
        const exists = prev.find(m => m.id === res.data.id);
        if (exists) return prev;
        return [...prev, res.data];
      });
    } catch (err) {
      console.error('Failed to send message', err);
    }
  };

  const handleTyping = (isTyping) => {
    if (!socket || !activeChannel) return;
    if (isTyping) socket.emit('typing', { channelId: activeChannel.id, username: user.username });
    else socket.emit('stop_typing', { channelId: activeChannel.id });
  };

  const handleContextMenu = (e, message, isSender) => {
    e.preventDefault();
    setContextMenu({ x: e.pageX, y: e.pageY, messageId: message.id, content: message.content, isSender });
  };

  const closeContextMenu = () => setContextMenu(null);

  const handleCopyMessage = () => {
    if (contextMenu?.content) navigator.clipboard.writeText(contextMenu.content);
    closeContextMenu();
  };

  const handleEditMessageClick = () => {
    const msg = messages.find(m => m.id === contextMenu.messageId);
    if (msg) { setEditingMessage(msg); setEditContent(msg.content); }
    closeContextMenu();
  };

  const handleSaveEdit = async () => {
    if (!editingMessage || !editContent.trim()) return;
    try {
      await api.put(`/api/messages/${editingMessage.id}`, { content: editContent });
      setEditingMessage(null);
      setEditContent('');
    } catch (err) {
      console.error('Failed to edit message', err);
    }
  };

  const handleDeleteMessage = async () => {
    if (!contextMenu?.messageId) return;
    try {
      await api.delete(`/api/messages/${contextMenu.messageId}`);
    } catch (err) {
      console.error('Failed to delete message', err);
    }
    closeContextMenu();
  };

  useEffect(() => {
    const handleClick = () => closeContextMenu();
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const renderAttachment = (url, isMe) => {
    if (!url) return null;
    const isImage = url.match(/\.(jpeg|jpg|gif|png|webp)$/i);
    const isPdf = url.match(/\.(pdf)$/i);

    if (isImage) {
      return (
        <div className="flex flex-col space-y-2 mt-2">
          <img src={url} alt="attachment" className="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition-opacity" onClick={() => window.open(url, '_blank')} />
          <a href={url} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center text-xs font-medium ${isMe ? 'text-primary-100' : 'text-primary-400'}`}>
            <Download size={14} className="mr-1" /> Download
          </a>
        </div>
      );
    }

    return (
      <div className={`flex flex-col mt-2 p-3 rounded-lg border ${isMe ? 'border-primary-400/50 bg-primary-500/20' : 'border-white/10 bg-navy-900/50'}`}>
        <div className="flex items-center mb-2">
          <FileText size={22} className={`mr-2 ${isMe ? 'text-white' : 'text-gray-400'}`} />
          <span className="font-medium text-sm truncate max-w-[180px]">{url.split('/').pop() || 'File'}</span>
        </div>
        <div className="flex space-x-3">
          {isPdf && (
            <a href={url} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center text-xs font-medium underline ${isMe ? 'text-primary-100' : 'text-primary-400'}`}>
              <ExternalLink size={12} className="mr-1" /> View
            </a>
          )}
          <a href={url} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center text-xs font-medium underline ${isMe ? 'text-primary-100' : 'text-primary-400'}`}>
            <Download size={12} className="mr-1" /> Download
          </a>
        </div>
      </div>
    );
  };

  // Can this user delete this message?
  const canDelete = (msg) => {
    if (msg.sender_id === user.id) return true;
    if (activeChannel?.userRole === 'admin') return true;
    return false;
  };

  return (
    <div className="flex flex-1 h-full overflow-hidden">
      <div className="flex-1 flex flex-col bg-navy-950 h-full relative min-w-0">
        {/* Header */}
        <div className="h-16 px-3 sm:px-4 flex items-center justify-between border-b border-white/5 bg-navy-950/80 backdrop-blur-md shadow-sm z-10 flex-shrink-0">
          <div className="flex items-center min-w-0">
            <button onClick={onMenuClick} className="mr-1 sm:mr-3 p-2 lg:hidden text-gray-400 hover:text-white transition-colors flex-shrink-0">
              <Menu size={22} />
            </button>
            <button onClick={onBackClick} className="mr-2 sm:mr-3 p-2 lg:hidden text-gray-400 hover:text-white transition-colors flex-shrink-0" title="Back">
              <ArrowLeft size={20} />
            </button>
            {activeChannel ? (
              <div className="flex items-center min-w-0">
                {activeChannel.is_private
                  ? <Lock size={18} className="text-red-400 mr-2 flex-shrink-0" />
                  : <Hash size={18} className="text-primary-400 mr-2 flex-shrink-0" />
                }
                <h2 className="text-base font-bold text-white truncate">{activeChannel.name}</h2>
                {activeChannel.is_private && (
                  <span className="ml-2 text-[10px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20 rounded-full px-2 py-0.5 flex-shrink-0">Private</span>
                )}
              </div>
            ) : (
              <div className="flex items-center min-w-0">
                <User size={18} className="text-primary-400 mr-2 flex-shrink-0" />
                <h2 className="text-base font-bold text-white truncate">{activeUser?.username}</h2>
              </div>
            )}
          </div>

          {/* Right header actions */}
          {activeChannel && isMember && (
            <button
              onClick={() => setIsInfoOpen(prev => !prev)}
              className={`flex-shrink-0 ml-2 p-2 sm:p-2.5 rounded-lg transition-colors ${isInfoOpen ? 'text-primary-400 bg-primary-500/10' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
              title="Channel Info"
            >
              <Info size={20} />
            </button>
          )}
        </div>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {!isMember && activeChannel ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-20 h-20 bg-navy-900 rounded-full flex items-center justify-center mb-5 border border-white/5">
                {activeChannel.is_private
                  ? <Lock size={40} className="text-red-400/50" />
                  : <Hash size={40} className="text-primary-500/50" />
                }
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                {activeChannel.is_private ? 'Private Channel' : `#${activeChannel.name}`}
              </h3>
              <p className="text-gray-400 mb-7 max-w-sm text-sm">
                {activeChannel.is_private
                  ? 'This is a private channel. You need an invitation from an admin to join.'
                  : 'Join this channel to view messages and participate in conversations.'
                }
              </p>
              {!activeChannel.is_private && (
                <button
                  onClick={handleJoinChannel}
                  disabled={isJoining}
                  className="bg-primary-600 hover:bg-primary-500 text-white font-medium py-2.5 px-8 rounded-full transition-all shadow-lg shadow-primary-500/20 disabled:opacity-50 transform hover:scale-105"
                >
                  {isJoining ? 'Joining...' : 'Join Channel'}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-5 flex flex-col justify-end min-h-full">
              {messages.map((msg, index) => {
                const isMe = msg.sender_id === user.id;
                const showHeader = index === 0
                  || messages[index - 1].sender_id !== msg.sender_id
                  || moment(msg.created_at).diff(moment(messages[index - 1].created_at), 'minutes') > 5;

                return (
                  <div key={msg.id} className={`flex animate-fade-in-up ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex max-w-[85%] lg:max-w-[70%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                      {!isMe && showHeader && (
                        <div className="mr-3 mt-1 flex-shrink-0">
                          {msg.sender?.avatar_url
                            ? <img src={msg.sender.avatar_url} alt="avatar" className="w-8 h-8 rounded-full object-cover border border-navy-800" />
                            : <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-xs font-bold">{msg.sender?.username?.charAt(0).toUpperCase()}</div>
                          }
                        </div>
                      )}
                      {!isMe && !showHeader && <div className="w-11 mr-3 flex-shrink-0" />}

                      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        {showHeader && !isMe && (
                          <div className="mb-1 pl-1">
                            <span className="font-medium text-xs text-gray-400">{msg.sender?.username}</span>
                          </div>
                        )}

                        <div
                          className={`relative px-4 py-3 rounded-2xl shadow-sm cursor-context-menu min-w-[80px] ${
                            isMe
                              ? 'bg-gradient-to-br from-primary-600 to-primary-700 text-white rounded-tr-sm border border-primary-500/20'
                              : 'bg-navy-800/80 text-gray-100 rounded-tl-sm border border-white/5'
                          }`}
                          onContextMenu={(e) => handleContextMenu(e, msg, isMe)}
                        >
                          {editingMessage?.id === msg.id ? (
                            <div className="flex flex-col min-w-[200px]">
                              <textarea
                                value={editContent}
                                onChange={e => setEditContent(e.target.value)}
                                className="w-full bg-white/20 border border-white/30 text-white rounded p-2 text-sm focus:outline-none mb-2 resize-none custom-scrollbar"
                                rows="2"
                                autoFocus
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); }
                                  if (e.key === 'Escape') setEditingMessage(null);
                                }}
                              />
                              <div className="flex justify-end space-x-2">
                                <button onClick={() => setEditingMessage(null)} className="text-xs text-white/70 hover:text-white px-2 py-1">Cancel</button>
                                <button onClick={handleSaveEdit} className="text-xs bg-white text-primary-600 rounded px-3 py-1 font-medium flex items-center hover:bg-gray-100">
                                  <Check size={11} className="mr-1" /> Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {msg.content && <p className="whitespace-pre-wrap break-words text-sm pb-4 leading-relaxed">{msg.content}</p>}
                              {renderAttachment(msg.file_url, isMe)}
                              <div className="absolute bottom-1.5 right-3 flex items-center space-x-1">
                                {msg.is_edited && <span className={`text-[10px] italic ${isMe ? 'text-primary-200/80' : 'text-gray-500'}`}>(edited)</span>}
                                <span className={`text-[10px] ${isMe ? 'text-primary-100/80' : 'text-gray-500'}`}>{moment(msg.created_at).format('h:mm A')}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {typingUsers.length > 0 && (
                <div className="flex items-center text-gray-400 text-sm italic pl-11 pb-1">
                  <div className="flex space-x-1 mr-2">
                    {[0, 150, 300].map(d => (
                      <div key={d} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                  {typingUsers.join(', ')} {typingUsers.length > 1 ? 'are' : 'is'} typing...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Context Menu */}
        {contextMenu && (
          <div
            className="fixed bg-navy-800 border border-white/10 shadow-2xl rounded-xl w-48 py-1.5 z-50 animate-in fade-in zoom-in duration-100"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={e => e.stopPropagation()}
          >
            {contextMenu.content && (
              <button className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-navy-700 flex items-center" onClick={handleCopyMessage}>
                <Copy size={15} className="mr-3 text-gray-400" /> Copy Text
              </button>
            )}
            {contextMenu.isSender && (
              <button className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-navy-700 flex items-center" onClick={handleEditMessageClick}>
                <Edit2 size={15} className="mr-3 text-gray-400" /> Edit Message
              </button>
            )}
            {canDelete(messages.find(m => m.id === contextMenu.messageId) || {}) && (
              <button className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 flex items-center" onClick={handleDeleteMessage}>
                <Trash2 size={15} className="mr-3 text-red-400" /> Delete Message
              </button>
            )}
          </div>
        )}

        {/* Input Area */}
        {((isMember && activeChannel) || (activeUser && requestStatus === 'accepted')) ? (
          <div className="p-3 sm:p-4 bg-transparent flex-shrink-0 z-10">
            <MessageInput onSendMessage={handleSendMessage} onTyping={handleTyping} />
          </div>
        ) : activeUser ? (
          <div className="p-4 sm:p-6 bg-navy-950 border-t border-white/5 flex-shrink-0 z-10">
            {requestStatus === 'none' && (
              <div className="text-center">
                <p className="text-gray-400 text-sm mb-3">You must send a message request before chatting with this user.</p>
                <button
                  onClick={handleSendRequest}
                  disabled={isRequesting}
                  className="bg-primary-600 hover:bg-primary-500 text-white font-medium py-2 px-6 rounded-full transition-all shadow-lg shadow-primary-500/20 disabled:opacity-50"
                >
                  {isRequesting ? 'Sending...' : 'Send Message Request'}
                </button>
              </div>
            )}
            
            {requestStatus === 'pending' && isRequestSender && (
              <div className="text-center">
                <p className="text-gray-400 text-sm mb-3">Your message request is pending approval.</p>
                <button
                  onClick={handleCancelRequest}
                  disabled={isRequesting}
                  className="bg-red-500/10 text-red-400 hover:bg-red-500/20 font-medium py-2 px-6 rounded-full transition-all disabled:opacity-50"
                >
                  Cancel Request
                </button>
              </div>
            )}

            {requestStatus === 'pending' && !isRequestSender && (
              <div className="text-center">
                <p className="text-white font-medium mb-1">{activeUser.username} wants to send you a message.</p>
                <p className="text-gray-400 text-sm mb-4">Accept to start chatting.</p>
                <div className="flex items-center justify-center space-x-3">
                  <button
                    onClick={() => handleRespondRequest('reject')}
                    disabled={isRequesting}
                    className="bg-red-500/10 text-red-400 hover:bg-red-500/20 font-medium py-2 px-6 rounded-full transition-all disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleRespondRequest('accept')}
                    disabled={isRequesting}
                    className="bg-primary-600 hover:bg-primary-500 text-white font-medium py-2 px-6 rounded-full transition-all shadow-lg shadow-primary-500/20 disabled:opacity-50"
                  >
                    Accept Request
                  </button>
                </div>
              </div>
            )}

            {requestStatus === 'rejected' && !isRequestSender && (
              <div className="text-center">
                <p className="text-red-400 text-sm">You have rejected this request.</p>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Group Info Panel */}
      {isInfoOpen && activeChannel && (
        <GroupInfoPanel
          channel={activeChannel}
          onClose={() => setIsInfoOpen(false)}
          onChannelLeft={(id) => { onChannelLeft?.(id); setIsInfoOpen(false); }}
          onChannelDeleted={(id) => { onChannelDeleted?.(id); setIsInfoOpen(false); }}
        />
      )}
    </div>
  );
};

export default ChatWindow;
