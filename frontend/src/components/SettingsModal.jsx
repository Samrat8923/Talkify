import { useState } from 'react';
import { X, Upload, Lock, User as UserIcon, LogOut } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const SettingsModal = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth(); // Assuming we might want to update user context, but reloading is simpler for now
  
  const [activeTab, setActiveTab] = useState('profile');
  const [username, setUsername] = useState(user?.username || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar_url || null);
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  if (!isOpen) return null;

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      if (avatarFile) {
        const formData = new FormData();
        formData.append('file', avatarFile);
        await api.put('/api/profile/avatar', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      if (username !== user?.username) {
        await api.put('/api/profile/update', { username });
      }

      setMessage({ type: 'success', text: 'Profile updated successfully. Refresh to see changes.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to update profile' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      await api.put('/api/profile/password', { currentPassword, newPassword });
      setMessage({ type: 'success', text: 'Password updated successfully.' });
      setCurrentPassword('');
      setNewPassword('');
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to update password' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-navy-950/80 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-navy-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] text-gray-200">
        
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex justify-between items-center bg-navy-950/50">
          <h2 className="text-xl font-bold text-white">Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-1.5 rounded-full">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 bg-navy-950/30">
          <button 
            className={`flex-1 py-3.5 text-sm font-medium transition-colors ${activeTab === 'profile' ? 'text-primary-400 border-b-2 border-primary-500 bg-white/5' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}
            onClick={() => setActiveTab('profile')}
          >
            <UserIcon size={16} className="inline mr-2" /> Profile
          </button>
          <button 
            className={`flex-1 py-3.5 text-sm font-medium transition-colors ${activeTab === 'security' ? 'text-primary-400 border-b-2 border-primary-500 bg-white/5' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}
            onClick={() => setActiveTab('security')}
          >
            <Lock size={16} className="inline mr-2" /> Security
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar">
          {message.text && (
            <div className={`p-4 mb-5 rounded-lg text-sm border ${message.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
              {message.text}
            </div>
          )}

          {activeTab === 'profile' && (
            <form onSubmit={handleUpdateProfile} className="space-y-6 animate-fade-in-up">
              <div className="flex flex-col items-center mb-6">
                <div className="relative group cursor-pointer">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" className="w-24 h-24 rounded-full object-cover border-4 border-navy-800 shadow-xl" />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-white flex items-center justify-center text-3xl font-bold border-4 border-navy-800 shadow-xl">
                      {user?.username?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <label className="absolute inset-0 bg-navy-950/60 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity cursor-pointer backdrop-blur-sm">
                    <Upload size={20} />
                    <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
                  </label>
                </div>
                <p className="text-xs text-gray-400 mt-3 font-medium">Click to change avatar</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Username</label>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-navy-950 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all shadow-inner"
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-gradient-to-r from-primary-500 to-primary-600 text-white font-medium py-2.5 rounded-lg hover:shadow-lg hover:shadow-primary-500/25 transition-all disabled:opacity-50 transform hover:-translate-y-0.5 active:translate-y-0"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          )}

          {activeTab === 'security' && (
            <form onSubmit={handleUpdatePassword} className="space-y-5 animate-fade-in-up">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Current Password</label>
                <input 
                  type="password" 
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="w-full bg-navy-950 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all shadow-inner"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">New Password</label>
                <input 
                  type="password" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-navy-950 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all shadow-inner"
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-gradient-to-r from-primary-500 to-primary-600 text-white font-medium py-2.5 rounded-lg hover:shadow-lg hover:shadow-primary-500/25 transition-all disabled:opacity-50 transform hover:-translate-y-0.5 active:translate-y-0 mt-2"
              >
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-white/10 bg-navy-950/50 flex justify-end">
          <button 
            onClick={() => {
              onClose();
              logout();
            }}
            className="text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500 font-medium text-sm px-5 py-2.5 rounded-lg transition-colors flex items-center shadow-sm"
          >
            <LogOut size={16} className="mr-2" /> Log Out Completely
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
