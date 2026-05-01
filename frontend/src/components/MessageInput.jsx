import { useState, useRef } from 'react';
import { Send, Paperclip, X } from 'lucide-react';

const MessageInput = ({ onSendMessage, onTyping }) => {
  const [content, setContent] = useState('');
  const [file, setFile] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim() && !file) return;

    setIsSending(true);
    await onSendMessage(content, file);
    setContent('');
    setFile(null);
    setIsSending(false);
    onTyping(false);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleChange = (e) => {
    setContent(e.target.value);
    onTyping(true);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      onTyping(false);
    }, 2000);
  };

  return (
    <form onSubmit={handleSubmit} className="relative max-w-4xl mx-auto w-full">
      {file && (
        <div className="absolute bottom-full mb-3 left-4 right-4 md:left-0 md:right-0 bg-navy-800 border border-white/10 rounded-xl p-3 flex items-center justify-between shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center text-sm text-gray-200 truncate">
            <div className="w-8 h-8 rounded bg-primary-500/20 flex items-center justify-center mr-3">
              <Paperclip size={16} className="text-primary-400" />
            </div>
            <span className="truncate font-medium">{file.name}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setFile(null)}
            className="text-gray-400 hover:text-red-400 hover:bg-white/5 rounded-full p-1.5 transition-all"
          >
            <X size={16} />
          </button>
        </div>
      )}
      <div className="flex items-end bg-navy-900/90 backdrop-blur-lg border border-white/10 rounded-full shadow-lg shadow-black/20 focus-within:ring-2 focus-within:ring-primary-500/50 focus-within:border-primary-500/50 transition-all duration-300">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-3 sm:p-3.5 ml-1 sm:ml-1 text-gray-400 hover:text-primary-400 hover:bg-white/5 rounded-full transition-all flex-shrink-0"
          title="Attach file"
        >
          <Paperclip size={20} />
        </button>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={(e) => setFile(e.target.files[0])}
          accept="image/*,application/pdf,video/mp4"
        />
        <textarea
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Message..."
          className="flex-1 max-h-32 min-h-[48px] sm:min-h-[52px] py-3 sm:py-3.5 px-2 bg-transparent border-none resize-none focus:ring-0 text-gray-100 placeholder-gray-500 text-[15px] sm:text-[15px] custom-scrollbar"
          rows={1}
        />
        <div className="p-1.5 mr-1 flex-shrink-0">
          <button
            type="submit"
            disabled={(!content.trim() && !file) || isSending}
            className={`h-10 w-10 sm:h-10 sm:w-10 flex items-center justify-center rounded-full transition-all duration-300 ${
              (!content.trim() && !file) || isSending
                ? 'bg-navy-800 text-gray-600 cursor-not-allowed'
                : 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-md shadow-primary-500/30 hover:shadow-lg hover:shadow-primary-500/40 transform hover:scale-105 active:scale-95'
            }`}
          >
            {isSending ? (
              <div className="w-5 h-5 border-2 border-white/80 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Send size={18} className={content.trim() || file ? "translate-x-0.5 -translate-y-0.5" : ""} />
            )}
          </button>
        </div>
      </div>
    </form>
  );
};

export default MessageInput;
