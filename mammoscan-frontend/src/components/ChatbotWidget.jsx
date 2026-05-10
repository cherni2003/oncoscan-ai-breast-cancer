import React, { useState, useEffect, useMemo } from 'react';
import { MessageCircle, X, Minimize2, Maximize2, Trash2 } from 'lucide-react';
import ChatMessage from './ChatMessage.jsx';
import ChatInput from './ChatInput.jsx';
import { useChatbot } from '../hooks/useChatbot.js';

const ChatbotWidget = () => {
  const [isOpen,       setIsOpen]       = useState(false);
  const [isMinimized,  setIsMinimized]  = useState(false);
  const { messages, isLoading, patientId, sendMessage, clearChat, messagesEndRef } = useChatbot();

  // Dernier message du bot (pour TTS automatique)
  const lastBotMessage = useMemo(() => {
    const botMessages = messages.filter(m => m.sender === 'bot');
    return botMessages.length > 0 ? botMessages[botMessages.length - 1] : null;
  }, [messages]);

  // Sauvegarder l'état ouvert/fermé
  useEffect(() => {
    const saved = localStorage.getItem('chatbotOpen');
    if (saved) setIsOpen(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('chatbotOpen', JSON.stringify(isOpen));
  }, [isOpen]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group z-50 hover:scale-110"
      >
        <MessageCircle className="w-6 h-6 text-white" />
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-green-500 rounded-full animate-pulse border-2 border-white" />
        <div className="absolute inset-0 rounded-full animate-ping bg-pink-400 opacity-20" />
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-6 right-6 bg-white rounded-2xl shadow-2xl flex flex-col transition-all duration-300 z-50 border border-gray-100 ${
        isMinimized ? 'w-80 h-14' : 'w-[500px] h-[700px]'
      }`}
    >
      {/* Header */}
      <div
        className="bg-gradient-to-r from-pink-500 to-purple-600 rounded-t-2xl p-4 text-white flex justify-between items-center cursor-pointer"
        onClick={() => !isMinimized && setIsMinimized(true)}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
            <MessageCircle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold">MammoScan AI Assistant</h3>
            {patientId && (
              <p className="text-xs text-pink-100">
                Patient actif : <span className="font-mono">{patientId}</span>
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); clearChat(); }}
            className="hover:bg-white/20 rounded-lg p-1.5 transition-colors"
            title="Effacer la conversation"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
            className="hover:bg-white/20 rounded-lg p-1.5 transition-colors"
          >
            {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
            className="hover:bg-white/20 rounded-lg p-1.5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Barre de statut */}
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-gray-600">IA en ligne</span>
            </div>
            <div className="text-gray-400">{messages.length} messages</div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {isLoading && (
              <div className="flex justify-start mb-4">
                <div className="bg-white rounded-2xl px-4 py-3 shadow-sm">
                  <div className="flex gap-1.5">
                    {[0, 150, 300].map((delay) => (
                      <span
                        key={delay}
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${delay}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input — reçoit le dernier message bot pour TTS */}
          <ChatInput
            onSendMessage={sendMessage}
            isLoading={isLoading}
            lastBotMessage={lastBotMessage}
          />
        </>
      )}
    </div>
  );
};

export default ChatbotWidget;