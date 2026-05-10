import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';

/* ── TTS helper ── */
const ttsSpeak = (text, onStart, onEnd) => {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang  = 'fr-FR'; utt.rate = 1.0; utt.pitch = 1.0;
  const voices = window.speechSynthesis.getVoices();
  const fr = voices.find(v => v.lang.startsWith('fr'));
  if (fr) utt.voice = fr;
  utt.onstart = () => onStart?.();
  utt.onend   = () => onEnd?.();
  utt.onerror = () => onEnd?.();
  window.speechSynthesis.speak(utt);
};

const inputStyles = `
  .ps-input-wrap {
    border-top:1px solid rgba(255,255,255,.07);
    background:rgba(10,5,8,.6);
    padding:10px 12px 12px;
    flex-shrink:0;
  }
  .ps-quick-actions {
    display:flex; gap:6px; overflow-x:auto; padding-bottom:8px;
    scrollbar-width:none;
  }
  .ps-quick-actions::-webkit-scrollbar { display:none; }
  .ps-qa-btn {
    display:inline-flex; align-items:center; gap:5px;
    padding:5px 11px; border-radius:99px; border:none;
    background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.08);
    color:rgba(203,213,225,.7); font-size:11.5px; white-space:nowrap;
    cursor:pointer; transition:all .15s; flex-shrink:0;
  }
  .ps-qa-btn:hover:not(:disabled) {
    background:rgba(225,29,72,.1); border-color:rgba(225,29,72,.3); color:#fb7185;
  }
  .ps-qa-btn:disabled { opacity:.4; cursor:not-allowed; }

  .ps-input-row { display:flex; align-items:center; gap:8px; }
  .ps-icon-action {
    background:none; border:none; cursor:pointer;
    width:34px; height:34px; border-radius:10px; flex-shrink:0;
    display:flex; align-items:center; justify-content:center;
    color:rgba(148,163,184,.5); transition:all .15s;
  }
  .ps-icon-action:hover { background:rgba(255,255,255,.06); color:#fb7185; }
  .ps-icon-action.active { background:rgba(225,29,72,.12); color:#fb7185; }
  .ps-icon-action.listening { background:rgba(225,29,72,.12); color:#f87171; animation:ps-pulse 1s infinite; }

  .ps-text-input {
    flex:1; background:rgba(255,255,255,.05);
    border:1px solid rgba(255,255,255,.09);
    border-radius:12px; padding:9px 14px;
    font-size:13px; color:#e2e8f0; outline:none;
    transition:all .2s; font-family:inherit;
  }
  .ps-text-input::placeholder { color:rgba(148,163,184,.4); }
  .ps-text-input:focus { border-color:rgba(225,29,72,.35); background:rgba(255,255,255,.07); }
  .ps-text-input.listening { border-color:rgba(225,29,72,.5); background:rgba(225,29,72,.05); }

  .ps-send-btn {
    width:36px; height:36px; border-radius:10px; border:none;
    display:flex; align-items:center; justify-content:center;
    cursor:pointer; transition:all .2s; flex-shrink:0;
  }
  .ps-send-btn.active {
    background:linear-gradient(135deg,#7f1d3a,#e11d48);
    box-shadow:0 4px 14px rgba(225,29,72,.3);
  }
  .ps-send-btn.active:hover { transform:scale(1.06); }
  .ps-send-btn.inactive { background:rgba(255,255,255,.07); cursor:not-allowed; }

  .ps-tts-indicator {
    display:flex; align-items:center; gap:6px;
    margin-top:7px; font-size:10.5px; color:rgba(251,113,133,.6);
  }
  .ps-tts-bar {
    width:3px; border-radius:2px; background:#fb7185;
    animation:ps-bounce 1.2s infinite;
  }
`;

const quickActions = [
  { emoji: '📊', label: 'Dashboard',   command: 'Afficher le tableau de bord' },
  { emoji: '🔬', label: 'Histopathologie', command: 'Résultat histopathologie' },
  { emoji: '📡', label: 'Mammographie', command: 'Résultat mammographie' },
  { emoji: '⚠️', label: 'Risque',       command: 'Évaluation du risque' },
  { emoji: '❓', label: 'Aide',         command: 'Aide' },
];

const ChatInput = ({ onSendMessage, isLoading, lastBotMessage }) => {
  const [message,     setMessage]     = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking,  setIsSpeaking]  = useState(false);
  const [ttsEnabled,  setTtsEnabled]  = useState(true);
  const recognitionRef = useRef(null);

  /* Auto-TTS sur nouveau message bot */
  useEffect(() => {
    if (!ttsEnabled || !lastBotMessage) return;
    const text = typeof lastBotMessage === 'string' ? lastBotMessage : lastBotMessage?.text;
    if (text) ttsSpeak(text, () => setIsSpeaking(true), () => setIsSpeaking(false));
  }, [lastBotMessage]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  /* Speech-to-Text */
  const toggleListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Reconnaissance vocale non disponible. Essayez Chrome."); return; }
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const r = new SR();
    r.lang = 'fr-FR'; r.interimResults = false; r.maxAlternatives = 1;
    r.onstart  = () => setIsListening(true);
    r.onend    = () => setIsListening(false);
    r.onerror  = () => setIsListening(false);
    r.onresult = e  => setMessage(e.results[0][0].transcript);
    recognitionRef.current = r;
    r.start();
  };

  const handleSend = () => {
    if (!message.trim() || isLoading) return;
    window.speechSynthesis?.cancel(); setIsSpeaking(false);
    onSendMessage(message); setMessage('');
  };

  return (
    <>
      <style>{inputStyles}</style>
      <div className="ps-input-wrap">

        {/* Quick actions */}
        <div className="ps-quick-actions">
          {quickActions.map((a, i) => (
            <button key={i} className="ps-qa-btn"
              onClick={() => onSendMessage(a.command)} disabled={isLoading}>
              <span>{a.emoji}</span> {a.label}
            </button>
          ))}
        </div>

        {/* Input row */}
        <div className="ps-input-row">
          {/* TTS toggle */}
          <button
            className={`ps-icon-action ${ttsEnabled ? 'active' : ''}`}
            onClick={() => { if (ttsEnabled) { window.speechSynthesis?.cancel(); setIsSpeaking(false); } setTtsEnabled(!ttsEnabled); }}
            title={ttsEnabled ? 'Désactiver la voix' : 'Activer la voix'}
          >
            {ttsEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          {/* Micro */}
          <button
            className={`ps-icon-action ${isListening ? 'listening' : ''}`}
            onClick={toggleListening}
            title={isListening ? "Arrêter l'écoute" : 'Dicter'}
          >
            {isListening ? <MicOff size={16} /> : <Mic size={16} />}
          </button>

          {/* Texte */}
          <input
            type="text"
            className={`ps-text-input ${isListening ? 'listening' : ''}`}
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
            placeholder={isListening ? '🎙️ Parlez maintenant…' : 'Posez votre question…'}
            disabled={isLoading}
          />

          {/* Envoyer */}
          <button
            className={`ps-send-btn ${message.trim() && !isLoading ? 'active' : 'inactive'}`}
            onClick={handleSend}
            disabled={!message.trim() || isLoading}
          >
            <Send size={15} color={message.trim() && !isLoading ? '#fff' : 'rgba(148,163,184,.4)'} />
          </button>
        </div>

        {/* Indicateur TTS */}
        {isSpeaking && (
          <div className="ps-tts-indicator">
            {[0,100,200,100,0].map((h,i) => (
              <span key={i} className="ps-tts-bar"
                style={{ height:`${8+h/10}px`, animationDelay:`${i*80}ms` }} />
            ))}
            <span>Lecture en cours…</span>
          </div>
        )}
      </div>
    </>
  );
};

export default ChatInput;