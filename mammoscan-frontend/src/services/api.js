import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export const chatbotAPI = {

  sendMessage: async (message, patientId) => {
    const response = await api.post('/chat', {
      message,
      patient_id: patientId || null,
    });
    return response.data;
  },

  getPatient: async (patientId) => {
    const response = await api.get(`/patient/${patientId}`);
    return response.data;
  },

  getAllPatients: async () => {
    const response = await api.get('/patients');
    return response.data;
  },

  getScan: async (patientId) => {
    const response = await api.get(`/scan/${patientId}`);
    return response.data;
  },

  getAllScans: async () => {
    const response = await api.get('/scans');
    return response.data;
  },

  getDashboard: async () => {
    const response = await api.get('/dashboard');
    return response.data;
  },
};

export default api;