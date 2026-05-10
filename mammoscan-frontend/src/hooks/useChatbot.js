import { useState, useCallback, useRef, useEffect } from 'react';
import { chatbotService } from '../services/chatbotService';

const WELCOME_MESSAGE = {
  id:        'welcome',
  text:      "Bonjour! 👋 Je suis l'assistant MammoScan AI.\n\nJe peux vous aider avec:\n• 📊 Dashboard — statistiques globales\n• 👤 Infos patient — ex: 'infos patient P001'\n• 🔬 Scan — ex: 'résultat scan P002'\n• ⚠️ Risque — ex: 'calcule risque P001'",
  sender:    'bot',
  timestamp: new Date(),
  type:      'text',
};

export const useChatbot = () => {
  const [messages,  setMessages]  = useState([WELCOME_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const [patientId, setPatientId] = useState(null);
  const messagesEndRef = useRef(null);

  // Sync patient ID avec le service
  useEffect(() => {
    chatbotService.setPatientId(patientId);
  }, [patientId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (msg) => setMessages(prev => [...prev, msg]);

  const sendMessage = useCallback(async (text) => {
    if (!text?.trim() || isLoading) return;

    // Message utilisateur
    addMessage({
      id:        Date.now().toString(),
      text,
      sender:    'user',
      timestamp: new Date(),
    });
    setIsLoading(true);

    try {
      const lower = text.toLowerCase();

      // Extraction du patient ID depuis le texte
      const idMatch = text.match(/\bP\d{3,}\b/i);
      if (idMatch) {
        const id = idMatch[0].toUpperCase();
        setPatientId(id);
        chatbotService.setPatientId(id);
      }

      // Routing des commandes
      let botMsg;

      if (lower.includes('dashboard') || lower.includes('statistiques') ||
          lower.includes('tableau de bord') || lower.includes('analytics')) {
        botMsg = await chatbotService.getDashboard();

      } else if (
        (lower.includes('scan') || lower.includes('mammograph') || lower.includes('birads')) &&
        (idMatch || patientId)
      ) {
        const id = idMatch ? idMatch[0].toUpperCase() : patientId;
        botMsg = await chatbotService.getScanResult(id);

      } else if (
        (lower.includes('patient') || lower.includes('infos') || lower.includes('profil')) &&
        idMatch
      ) {
        botMsg = await chatbotService.getPatientInfo(idMatch[0].toUpperCase());

      } else {
        // Envoie au chatbot NLP
        botMsg = await chatbotService.sendMessage(text);
      }

      addMessage(botMsg);
    } catch (error) {
      addMessage({
        id:        Date.now().toString(),
        text:      "Une erreur inattendue s'est produite. Veuillez réessayer.",
        sender:    'bot',
        timestamp: new Date(),
        type:      'text',
      });
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, patientId]);

  const clearChat = useCallback(() => {
    setMessages([{ ...WELCOME_MESSAGE, timestamp: new Date() }]);
    setPatientId(null);
    chatbotService.setPatientId(null);
  }, []);

  const setActivePatient = useCallback((id) => {
    setPatientId(id);
    chatbotService.setPatientId(id);
    sendMessage(`infos patient ${id}`);
  }, [sendMessage]);

  return {
    messages,
    isLoading,
    patientId,
    sendMessage,
    clearChat,
    setActivePatient,
    messagesEndRef,
  };
};