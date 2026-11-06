import api from './client';

export const storageApi = {
  getOverview: async (ordering = '-storage_bytes') => {
    const response = await api.get('/admin/storage', {
      params: { ordering },
    });
    return response.data;
  },

  recalculate: async () => {
    const response = await api.post('/admin/storage/recalculate');
    return response.data;
  },

  clearZips: async () => {
    const response = await api.post('/admin/storage/clear-zips');
    return response.data;
  },

  getDashboard: async () => {
    const response = await api.get('/admin/dashboard');
    return response.data;
  },
};
