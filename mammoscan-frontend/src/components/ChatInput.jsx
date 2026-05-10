import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, MicOff, Volume2, VolumeX, Sparkles } from 'lucide-react';

// ── Text-to-Speech helper ─────────────────────────────────────────────────────
const ttsSpeak = (text, onStart, onEnd) => {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'fr-FR';
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  // Choisir une voix française si disponible
  const voices = window.speechSynthesis.getVoices();
  const frVoice = voices.find(v => v.lang.startsWith('fr'));
  if (frVoice) utterance.voice = frVoice;

  utterance.onstart = () => onStart?.();
  utterance.onend   = () => onEnd?.();
  utterance.onerror = () => onEnd?.();

  window.speechSynthesis.speak(utterance);
};

// ── ChatInput ─────────────────────────────────────────────────────────────────
const ChatInput = ({ onSendMessage, isLoading, lastBotMessage }) => {
  const [message,      setMessage]      = useState('');
  const [isListening,  setIsListening]  = useState(false);
  const [isSpeaking,   setIsSpeaking]   = useState(false);
  const [ttsEnabled,   setTtsEnabled]   = useState(true);
  const recognitionRef = useRef(null);

  // ── Lire automatiquement le dernier message bot si TTS activé ────────────
  useEffect(() => {
    if (!ttsEnabled || !lastBotMessage) return;
    const text = typeof lastBotMessage === 'string' ? lastBotMessage : lastBotMessage?.text;
    if (text) {
      ttsSpeak(text, () => setIsSpeaking(true), () => setIsSpeaking(false));
    }
  }, [lastBotMessage]);

  // ── Arrêter TTS quand on ferme ───────────────────────────────────────────
  useEffect(() => {
    return () => window.speechSynthesis?.cancel();
  }, []);

  // ── Speech-to-Text (Web Speech API) ─────────────────────────────────────
  const toggleListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Votre navigateur ne supporte pas la reconnaissance vocale. Essayez Chrome.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang            = 'fr-FR';
    recognition.interimResults  = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend   = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setMessage(transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  // ── Envoyer ──────────────────────────────────────────────────────────────
  const handleSend = () => {
    if (message.trim() && !isLoading) {
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
      onSendMessage(message);
      setMessage('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickActions = [
    { emoji: '📊', label: 'Tableau de bord', command: 'Afficher le tableau de bord' },
    { emoji: '👤', label: 'Patient P001',     command: 'Infos patient P001' },
    { emoji: '🔬', label: 'Scan P001',        command: 'Résultat scan P001' },
    { emoji: '⚠️', label: 'Risque P001',      command: 'Calcule le risque P001' },
  ];

  return (
    <div className="border-t border-gray-200 bg-white p-4 rounded-b-2xl">
      {/* Quick Actions */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-2 scrollbar-thin">
        {quickActions.map((action, idx) => (
          <button
            key={idx}
            onClick={() => onSendMessage(action.command)}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-full text-sm text-gray-700 whitespace-nowrap transition-all hover:scale-105"
          >
            <span className="text-base">{action.emoji}</span>
            <span>{action.label}</span>
          </button>
        ))}
      </div>

      {/* Input Area */}
      <div className="flex items-center gap-2">

        {/* Bouton TTS toggle */}
        <button
          onClick={() => {
            if (ttsEnabled) {
              window.speechSynthesis?.cancel();
              setIsSpeaking(false);
            }
            setTtsEnabled(!ttsEnabled);
          }}
          className={`p-2 rounded-full transition-colors ${
            ttsEnabled
              ? 'text-purple-500 bg-purple-50 hover:bg-purple-100'
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
          }`}
          title={ttsEnabled ? 'Désactiver la voix' : 'Activer la voix'}
        >
          {ttsEnabled
            ? <Volume2 className={`w-5 h-5 ${isSpeaking ? 'animate-pulse' : ''}`} />
            : <VolumeX className="w-5 h-5" />
          }
        </button>

        {/* Bouton micro (Speech-to-Text) */}
        <button
          onClick={toggleListening}
          className={`p-2 rounded-full transition-colors ${
            isListening
              ? 'text-red-500 bg-red-50 animate-pulse'
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
          }`}
          title={isListening ? 'Arrêter l\'écoute' : 'Parler'}
        >
          {isListening
            ? <MicOff className="w-5 h-5" />
            : <Mic    className="w-5 h-5" />
          }
        </button>

        {/* Champ texte */}
        <div className="flex-1 relative">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={
              isListening
                ? '🎙️ Parlez maintenant...'
                : 'Posez votre question (patients, scans, risques)...'
            }
            className={`w-full px-4 py-2.5 border rounded-full focus:outline-none transition-all ${
              isListening
                ? 'border-red-400 ring-2 ring-red-200 bg-red-50'
                : 'border-gray-300 focus:border-pink-400 focus:ring-2 focus:ring-pink-200'
            }`}
            disabled={isLoading}
          />
          {message && !isListening && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Sparkles className="w-4 h-4 text-pink-400" />
            </div>
          )}
        </div>

        {/* Bouton envoyer */}
        <button
          onClick={handleSend}
          disabled={!message.trim() || isLoading}
          className={`p-2.5 rounded-full transition-all ${
            message.trim() && !isLoading
              ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:shadow-lg hover:scale-105'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          <Send className="w-5 h-5" />
        </button>
      </div>

      {/* Indicateur TTS actif */}
      {isSpeaking && (
        <div className="mt-2 flex items-center gap-2 text-xs text-purple-500">
          <div className="flex gap-0.5">
            {[0, 100, 200].map(delay => (
              <span
                key={delay}
                className="w-1 h-3 bg-purple-400 rounded-full animate-bounce"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
          <span>Lecture en cours… cliquez sur 🔊 pour arrêter</span>
        </div>
      )}
    </div>
  );
};

export default ChatInput;