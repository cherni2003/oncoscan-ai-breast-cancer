import { chatbotAPI } from './api';

class ChatbotService {
  constructor() {
    this.currentPatientId = null;
  }

  setPatientId(patientId) {
    this.currentPatientId = patientId;
  }

  getPatientId() {
    return this.currentPatientId;
  }

  /** Extrait un ID patient (P001, P002…) depuis le message. */
  _extractPatientId(message) {
    const match = message.match(/\bP\d{3,}\b/i);
    return match ? match[0].toUpperCase() : null;
  }

  /** Détermine le type de message à partir de la réponse du backend. */
  _detectType(response) {
    if (response.data?.patient_id && response.data?.age !== undefined) return 'patient_info';
    if (response.data?.birads_result !== undefined)                      return 'scan_result';
    if (response.data?.total_patients !== undefined)                     return 'dashboard';
    if (response.risk_score !== undefined)                               return 'risk';
    return 'text';
  }

  async sendMessage(message) {
    // Extrait l'ID patient depuis le message si possible
    const extractedId = this._extractPatientId(message);
    if (extractedId) this.currentPatientId = extractedId;

    try {
      const response = await chatbotAPI.sendMessage(message, this.currentPatientId);

      return {
        id:         Date.now().toString(),
        text:       response.response,
        sender:     'bot',
        timestamp:  new Date(),
        confidence: response.confidence,
        data:       response.data    || null,
        risk_score: response.risk_score ?? null,
        type:       this._detectType(response),
      };
    } catch (error) {
      console.error('ChatbotService.sendMessage error:', error);
      return this._errorMessage(
        "Impossible de joindre le serveur. Assurez-vous que le backend FastAPI tourne sur le port 8000."
      );
    }
  }

  async getPatientInfo(patientId) {
    try {
      const patient = await chatbotAPI.getPatient(patientId);
      return {
        id:        Date.now().toString(),
        text:      `Informations du patient ${patientId}`,
        sender:    'bot',
        timestamp: new Date(),
        data:      patient,
        type:      'patient_info',
      };
    } catch {
      return this._errorMessage(`Patient ${patientId} non trouvé. Vérifiez l'ID.`);
    }
  }

  async getDashboard() {
    try {
      const stats = await chatbotAPI.getDashboard();
      return {
        id:        Date.now().toString(),
        text:      'Statistiques du tableau de bord',
        sender:    'bot',
        timestamp: new Date(),
        data:      stats,
        type:      'dashboard',
      };
    } catch {
      return this._errorMessage('Impossible de charger les statistiques.');
    }
  }

  async getScanResult(patientId) {
    try {
      const scan = await chatbotAPI.getScan(patientId);
      return {
        id:        Date.now().toString(),
        text:      `Dernier scan du patient ${patientId}`,
        sender:    'bot',
        timestamp: new Date(),
        data:      scan,
        type:      'scan_result',
      };
    } catch {
      return this._errorMessage(`Aucun scan trouvé pour ${patientId}.`);
    }
  }

  _errorMessage(text) {
    return {
      id:        Date.now().toString(),
      text,
      sender:    'bot',
      timestamp: new Date(),
      type:      'text',
    };
  }
}

export const chatbotService = new ChatbotService();