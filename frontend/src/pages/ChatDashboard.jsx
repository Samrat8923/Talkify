import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import { useSocket } from '../context/SocketContext';

const ChatDashboard = () => {
  const { channelId, userId } = useParams();
  const [activeChannel, setActiveChannel] = useState(null);
  const [activeUser, setActiveUser] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarKey, setSidebarKey] = useState(0); // force Sidebar re-fetch
  const socket = useSocket();
  const navigate = useNavigate();

  useEffect(() => {
    if (socket && activeChannel) {
      socket.emit('join_channel', activeChannel.id);
      return () => { socket.emit('leave_channel', activeChannel.id); };
    }
  }, [socket, activeChannel]);

  useEffect(() => {
    if (channelId || userId) setIsSidebarOpen(false);
    else setIsSidebarOpen(true);
  }, [channelId, userId]);

  const handleChannelLeft = useCallback((id) => {
    setSidebarKey(prev => prev + 1);
    if (channelId === id) navigate('/');
  }, [channelId, navigate]);

  const handleChannelDeleted = useCallback((id) => {
    setSidebarKey(prev => prev + 1);
    if (channelId === id) navigate('/');
  }, [channelId, navigate]);

  const handleRefreshSidebar = useCallback(() => {
    setSidebarKey(prev => prev + 1);
  }, []);

  const sidebarEl = (
    <Sidebar
      key={sidebarKey}
      setActiveChannel={setActiveChannel}
      setActiveUser={setActiveUser}
      onChannelDeleted={handleChannelDeleted}
    />
  );

  return (
    <div className="flex h-screen bg-navy-950 overflow-hidden">
      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden animate-in fade-in duration-200">
          <div 
            className="fixed inset-0 bg-navy-950/80 backdrop-blur-sm" 
            onClick={() => setIsSidebarOpen(false)} 
          />
          <div className="relative w-72 max-w-[85vw] flex flex-col h-full animate-in slide-in-from-left duration-200">
            {sidebarEl}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <div className="w-64 flex flex-col">
          {sidebarEl}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex min-w-0 bg-navy-950 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 left-0 right-0 h-96 bg-primary-600/5 blur-[100px] pointer-events-none" />

        {(activeChannel || activeUser) ? (
          <ChatWindow
            activeChannel={activeChannel}
            activeUser={activeUser}
            onMenuClick={() => setIsSidebarOpen(true)}
            onBackClick={() => navigate('/')}
            onChannelLeft={handleChannelLeft}
            onChannelDeleted={handleChannelDeleted}
            onRefreshSidebar={handleRefreshSidebar}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center relative z-10 p-6">
            <div className="text-center max-w-md backdrop-blur-md bg-navy-900/60 p-8 sm:p-10 rounded-2xl shadow-2xl border border-white/5 relative overflow-hidden group">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary-500/20 rounded-full blur-2xl group-hover:bg-primary-500/30 transition-colors duration-700" />
              <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary-500/20 transform -rotate-6 group-hover:rotate-0 transition-all duration-300">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 tracking-tight">Welcome to Talkify</h2>
              <p className="text-gray-400 text-sm leading-relaxed mb-8">
                You don't have any chats open right now. Search for a user or discover public channels to start chatting!
              </p>
              
              <div className="flex flex-col space-y-3 w-full max-w-[240px] mx-auto mb-6">
                <button 
                  onClick={() => {
                    setIsSidebarOpen(true);
                    setTimeout(() => window.dispatchEvent(new Event('focus-search')), 50);
                  }}
                  className="w-full flex items-center justify-center bg-primary-600 hover:bg-primary-500 text-white py-2.5 px-4 rounded-xl text-sm font-medium transition-all shadow-lg shadow-primary-500/20 transform hover:-translate-y-0.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  Search Users
                </button>
                <button 
                  onClick={() => {
                    setIsSidebarOpen(true);
                    window.dispatchEvent(new Event('open-discover'));
                  }}
                  className="w-full flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 py-2.5 px-4 rounded-xl text-sm font-medium transition-all transform hover:-translate-y-0.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                  Discover Channels
                </button>
              </div>

              <div className="flex items-center justify-center space-x-2 text-xs text-gray-500 bg-navy-950/50 py-2 px-4 rounded-full w-fit mx-auto border border-white/5">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span>You are online and ready to chat</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatDashboard;
