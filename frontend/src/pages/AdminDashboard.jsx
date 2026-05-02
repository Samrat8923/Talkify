import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, ShieldAlert, ArrowLeft, Users, MessageSquare } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeTab, setActiveTab] = useState('users');
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/');
      return;
    }
    fetchData();
  }, [user, navigate, activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'users') {
        const res = await api.get('/api/admin/users');
        setUsers(res.data);
      } else {
        const res = await api.get('/api/admin/messages');
        setMessages(res.data);
      }
    } catch (error) {
      console.error('Failed to fetch data', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm("Are you sure you want to delete this user? This will delete all their messages.")) return;
    try {
      await api.delete(`/api/admin/user/${id}`);
      setUsers(users.filter(u => u.id !== id));
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to delete user');
    }
  };

  const handleToggleBan = async (id) => {
    try {
      const res = await api.put(`/api/admin/user/${id}/ban`);
      setUsers(users.map(u => u.id === id ? { ...u, is_banned: res.data.user.is_banned } : u));
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to toggle ban status');
    }
  };

  const handleDeleteMessage = async (id) => {
    if (!window.confirm("Are you sure you want to delete this message?")) return;
    try {
      await api.delete(`/api/admin/message/${id}`);
      setMessages(messages.filter(m => m.id !== id));
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to delete message');
    }
  };

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 text-white p-4 shadow-md flex items-center justify-between">
        <div className="flex items-center">
          <button onClick={() => navigate('/')} className="mr-4 text-gray-400 hover:text-white transition">
            <ArrowLeft size={24} />
          </button>
          <ShieldAlert className="text-red-500 mr-2" />
          <h1 className="text-xl font-bold">Admin Dashboard</h1>
        </div>
        <div className="flex bg-gray-800 rounded-lg p-1">
          <button 
            className={`px-4 py-2 rounded-md text-sm font-medium flex items-center transition ${activeTab === 'users' ? 'bg-primary-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab('users')}
          >
            <Users size={16} className="mr-2" /> Users
          </button>
          <button 
            className={`px-4 py-2 rounded-md text-sm font-medium flex items-center transition ${activeTab === 'messages' ? 'bg-primary-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab('messages')}
          >
            <MessageSquare size={16} className="mr-2" /> Messages
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading data...</div>
          ) : activeTab === 'users' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                    <th className="p-4">Username</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Joined</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50 transition">
                      <td className="p-4 font-medium text-gray-900">{u.username}</td>
                      <td className="p-4 text-gray-600">{u.email}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${u.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`flex items-center text-xs font-medium ${u.is_online ? 'text-green-600' : 'text-gray-400'}`}>
                          <span className={`w-2 h-2 rounded-full mr-1.5 ${u.is_online ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                          {u.is_online ? 'Online' : 'Offline'}
                        </span>
                      </td>
                      <td className="p-4 text-gray-500">{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="p-4 text-right">
                        {u.id !== user.id && u.role !== 'admin' && (
                          <>
                            <button 
                              onClick={() => handleToggleBan(u.id)}
                              className={`p-1 rounded transition mr-2 ${u.is_banned ? 'text-yellow-600 hover:bg-yellow-50' : 'text-orange-500 hover:bg-orange-50'}`}
                              title={u.is_banned ? "Unban User" : "Ban User"}
                            >
                              <ShieldAlert size={18} />
                            </button>
                            <button 
                              onClick={() => handleDeleteUser(u.id)}
                              className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition"
                              title="Delete User"
                            >
                              <Trash2 size={18} />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                    <th className="p-4">Content</th>
                    <th className="p-4">Sender</th>
                    <th className="p-4">Channel</th>
                    <th className="p-4">Date</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm">
                  {messages.map(m => (
                    <tr key={m.id} className="hover:bg-gray-50 transition">
                      <td className="p-4 text-gray-900 max-w-md truncate">
                        {m.content || <span className="text-gray-400 italic">[File Attached]</span>}
                      </td>
                      <td className="p-4 text-gray-600">{m.sender?.username || 'Unknown'}</td>
                      <td className="p-4 text-gray-500">
                        {m.channel?.name ? `#${m.channel.name}` : 'Direct Message'}
                      </td>
                      <td className="p-4 text-gray-500">
                        {new Date(m.created_at).toLocaleString()}
                      </td>
                      <td className="p-4 text-right">
                        <button 
                          onClick={() => handleDeleteMessage(m.id)}
                          className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition"
                          title="Delete Message"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
