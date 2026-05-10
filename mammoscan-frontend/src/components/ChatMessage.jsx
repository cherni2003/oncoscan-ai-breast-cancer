import React from 'react';
import PatientInfoCard from './PatientInfoCard';
import ScanResultCard from './ScanResultCard';
import DashboardStats from './DashboardStats';
import RiskScoreCard from './RiskScoreCard';

// Tags qui sont des réponses textuelles pures — pas de carte enrichie
const TEXT_ONLY_TYPES = ['text', 'greeting', 'goodbye', 'thanks', 'aide', 'birads', 'cancer_info', undefined];

const ChatMessage = ({ message }) => {
  const isUser = message.sender === 'user';

  const renderContent = () => {
    if (isUser) {
      return <p className="text-white">{message.text}</p>;
    }

    // Affichage selon le type de message
    switch (message.type) {
      case 'patient_info':
        return (
          <div>
            <p className="text-gray-700 mb-2">{message.text}</p>
            <PatientInfoCard patient={message.data} />
          </div>
        );

      case 'scan_result':
        return (
          <div>
            <p className="text-gray-700 mb-2">{message.text}</p>
            <ScanResultCard scan={message.data} />
          </div>
        );

      case 'dashboard':
        return (
          <div>
            <p className="text-gray-700 mb-2">{message.text}</p>
            <DashboardStats stats={message.data} />
          </div>
        );

      case 'risk':
        // Uniquement quand le type est explicitement 'risk' avec un score valide
        return (
          <div>
            <p className="text-gray-700 mb-2">{message.text}</p>
            {typeof message.risk_score === 'number' && (
              <RiskScoreCard score={message.risk_score} />
            )}
          </div>
        );

      default:
        // Réponse textuelle pure (greeting, goodbye, thanks, aide, etc.)
        return (
          <div>
            <p className="text-gray-700 whitespace-pre-wrap">{message.text}</p>
            {/* Barre de confiance uniquement si score > 0 et type non textuel pur */}
            {typeof message.confidence === 'number' &&
              message.confidence > 0 &&
              !TEXT_ONLY_TYPES.includes(message.type) && (
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all duration-500"
                    style={{ width: `${message.confidence * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400">
                  Confiance : {(message.confidence * 100).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 animate-fade-in`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 flex items-center justify-center mr-2 flex-shrink-0 shadow-md">
          <span className="text-white text-xs font-bold">AI</span>
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
          isUser
            ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white'
            : 'bg-white border border-gray-100 text-gray-800'
        }`}
      >
        {renderContent()}
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center ml-2 flex-shrink-0">
          <span className="text-gray-600 text-xs font-bold">U</span>
        </div>
      )}
    </div>
  );
};

export default ChatMessage;