import React, { useState, useEffect, useMemo } from 'react';
import { MessageCircle, X, Minimize2, Maximize2, Trash2, Activity } from 'lucide-react';
import ChatMessage from './ChatMessage.jsx';
import ChatInput from './ChatInput.jsx';
import { useChatbot } from '../hooks/useChatbot.js';

const ChatbotWidget = () => {
  const [isOpen,      setIsOpen]      = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const { messages, isLoading, patientId, sendMessage, clearChat, messagesEndRef } = useChatbot();

  const lastBotMessage = useMemo(() => {
    const botMessages = messages.filter(m => m.sender === 'bot');
    return botMessages.length > 0 ? botMessages[botMessages.length - 1] : null;
  }, [messages]);

  useEffect(() => {
    const saved = localStorage.getItem('pathoscan_chatbot_open');
    if (saved) setIsOpen(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('pathoscan_chatbot_open', JSON.stringify(isOpen));
  }, [isOpen]);

  /* ── Styles partagés injectés une seule fois ── */
  const styles = `
    @keyframes ps-pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
    @keyframes ps-ping   { 0%{transform:scale(1);opacity:.7} 100%{transform:scale(1.8);opacity:0} }
    @keyframes ps-bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
    @keyframes ps-fadein { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }

    .ps-widget-btn {
      position:fixed; bottom:28px; right:28px; z-index:1000;
      width:56px; height:56px; border-radius:50%; border:none;
      background:linear-gradient(135deg,#1a0a10 0%,#7f1d3a 100%);
      box-shadow:0 8px 32px rgba(225,29,72,.35);
      cursor:pointer; display:flex; align-items:center; justify-content:center;
      transition:all .25s cubic-bezier(.34,1.56,.64,1);
    }
    .ps-widget-btn:hover { transform:scale(1.12); box-shadow:0 12px 40px rgba(225,29,72,.5); }
    .ps-badge-online {
      position:absolute; top:2px; right:2px;
      width:12px; height:12px; border-radius:50%;
      background:#22c55e; border:2px solid #fff;
      animation:ps-pulse 2s infinite;
    }
    .ps-ping-ring {
      position:absolute; inset:0; border-radius:50%;
      background:rgba(225,29,72,.25);
      animation:ps-ping 2s cubic-bezier(0,0,.2,1) infinite;
    }

    .ps-widget {
      position:fixed; bottom:28px; right:28px; z-index:1000;
      display:flex; flex-direction:column;
      border-radius:20px; overflow:hidden;
      border:1px solid rgba(225,29,72,.18);
      box-shadow:0 24px 80px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.04);
      background:rgba(15,8,12,.94);
      backdrop-filter:blur(24px);
      animation:ps-fadein .25s both;
      font-family:var(--font-display,'Segoe UI',sans-serif);
      transition:width .3s,height .3s;
    }
    .ps-widget.open { width:480px; height:680px; }
    .ps-widget.mini { width:320px; height:58px; }

    .ps-header {
      background:linear-gradient(135deg,#1a0a10 0%,#3d0b1e 100%);
      padding:13px 16px;
      display:flex; align-items:center; justify-content:space-between;
      border-bottom:1px solid rgba(225,29,72,.15);
      flex-shrink:0;
    }
    .ps-header-left { display:flex; align-items:center; gap:10px; }
    .ps-logo {
      width:34px; height:34px; border-radius:10px; flex-shrink:0;
      background:rgba(225,29,72,.12); border:1px solid rgba(225,29,72,.28);
      display:flex; align-items:center; justify-content:center;
    }
    .ps-title  { font-weight:700; font-size:13.5px; color:#f1f5f9; letter-spacing:-.2px; }
    .ps-sub    { font-size:10.5px; color:rgba(251,113,133,.65); margin-top:1px; }
    .ps-pid    {
      display:inline-flex; align-items:center; gap:4px;
      padding:3px 9px; border-radius:99px;
      background:rgba(225,29,72,.1); border:1px solid rgba(225,29,72,.22);
      font-size:10px; font-weight:600; color:#fb7185; font-family:monospace;
    }
    .ps-ibtn {
      background:none; border:none; cursor:pointer;
      width:30px; height:30px; border-radius:8px;
      display:flex; align-items:center; justify-content:center;
      color:rgba(251,113,133,.55); transition:all .15s;
    }
    .ps-ibtn:hover { background:rgba(225,29,72,.1); color:#fb7185; }

    .ps-statusbar {
      padding:7px 14px;
      background:rgba(255,255,255,.018);
      border-bottom:1px solid rgba(255,255,255,.05);
      display:flex; align-items:center; justify-content:space-between;
      font-size:11px; color:rgba(148,163,184,.55); flex-shrink:0;
    }
    .ps-dot { width:7px; height:7px; border-radius:50%; background:#22c55e; animation:ps-pulse 2s infinite; }

    .ps-messages {
      flex:1; overflow-y:auto; padding:14px 12px;
      display:flex; flex-direction:column;
    }
    .ps-messages::-webkit-scrollbar { width:3px; }
    .ps-messages::-webkit-scrollbar-thumb { background:rgba(225,29,72,.18); border-radius:2px; }

    .ps-typing-bubble {
      display:inline-flex; gap:4px; align-items:center;
      padding:10px 14px; border-radius:16px;
      background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.07);
      margin:6px 0;
    }
    .ps-tdot {
      width:7px; height:7px; border-radius:50%;
      background:#fb7185; animation:ps-bounce 1.2s infinite;
    }
  `;

  /* ── Bouton flottant ── */
  if (!isOpen) return (
    <>
      <style>{styles}</style>
      <button className="ps-widget-btn" onClick={() => setIsOpen(true)}>
        <MessageCircle size={24} color="#fff" />
        <span className="ps-badge-online" />
        <span className="ps-ping-ring" />
      </button>
    </>
  );

  /* ── Widget ouvert ── */
  return (
    <>
      <style>{styles}</style>
      <div className={`ps-widget ${isMinimized ? 'mini' : 'open'}`}>

        {/* Header */}
        <div
          className="ps-header"
          style={{ cursor: isMinimized ? 'pointer' : 'default' }}
          onClick={() => isMinimized && setIsMinimized(false)}
        >
          <div className="ps-header-left">
            <div className="ps-logo">
              <Activity size={16} color="#fb7185" />
            </div>
            <div>
              <div className="ps-title">PathoScan Assistant</div>
              {!isMinimized && (
                patientId
                  ? <div className="ps-pid">● {patientId}</div>
                  : <div className="ps-sub">Diagnostic IA · Tunisie 2025</div>
              )}
            </div>
          </div>
          <div style={{ display:'flex', gap:4 }}>
            <button className="ps-ibtn" onClick={e => { e.stopPropagation(); clearChat(); }} title="Effacer">
              <Trash2 size={14} />
            </button>
            <button className="ps-ibtn" onClick={e => { e.stopPropagation(); setIsMinimized(!isMinimized); }}>
              {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
            </button>
            <button className="ps-ibtn" onClick={e => { e.stopPropagation(); setIsOpen(false); }}>
              <X size={14} />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Status bar */}
            <div className="ps-statusbar">
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span className="ps-dot" />
                <span>IA en ligne</span>
              </div>
              <span>{messages.length} messages</span>
            </div>

            {/* Messages */}
            <div className="ps-messages">
              {messages.map(msg => (
                <ChatMessage key={msg.id} message={msg} />
              ))}
              {isLoading && (
                <div style={{ display:'flex', marginTop:4 }}>
                  <div className="ps-typing-bubble">
                    {[0,150,300].map(d => (
                      <span key={d} className="ps-tdot" style={{ animationDelay:`${d}ms` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <ChatInput
              onSendMessage={sendMessage}
              isLoading={isLoading}
              lastBotMessage={lastBotMessage}
            />
          </>
        )}
      </div>
    </>
  );
};

export default ChatbotWidget;