import React, { useState } from 'react';
import ChatbotWidget from './components/ChatbotWidget.jsx';

const App = () => {
  const [showDemo, setShowDemo] = useState(true);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
                  MammoScan
                </h1>
                <p className="text-xs text-gray-500">Dépistage du Cancer du Sein par IA</p>
              </div>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowDemo(!showDemo)}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                {showDemo ? 'Masquer' : 'Afficher'} la démo
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {showDemo && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              🚀 Commandes disponibles
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <code className="text-sm text-pink-600">"Show me the dashboard"</code>
                <p className="text-xs text-gray-500 mt-1">Affiche les statistiques globales</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <code className="text-sm text-pink-600">"Get patient info for P001"</code>
                <p className="text-xs text-gray-500 mt-1">Informations du patient</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <code className="text-sm text-pink-600">"Show scan result for P001"</code>
                <p className="text-xs text-gray-500 mt-1">Résultats de mammographie</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <code className="text-sm text-pink-600">"Calculate risk for P001"</code>
                <p className="text-xs text-gray-500 mt-1">Évaluation du risque</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl p-8 text-center border border-pink-100">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">
            Bienvenue sur MammoScan
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Plateforme de dépistage assistée par intelligence artificielle pour la détection précoce du cancer du sein.
            Utilisez l'assistant en bas à droite pour interagir avec vos données.
          </p>
        </div>
      </div>

      {/* Chatbot Widget */}
      <ChatbotWidget />
    </div>
  );
};

export default App;