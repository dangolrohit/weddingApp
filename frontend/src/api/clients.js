import api from './client';

export const clientsApi = {
  list: async (params = {}) => {
    const response = await api.get('/admin/clients', { params });
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('/admin/clients', data);
    return response.data;
  },
  get: async (id) => {
    const response = await api.get(`/admin/clients/${id}`);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.patch(`/admin/clients/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/admin/clients/${id}`);
    return response.data;
  },
  restore: async (id) => {
    const response = await api.post(`/admin/clients/${id}/restore`);
    return response.data;
  },
  regeneratePasskey: async (id) => {
    const response = await api.post(`/admin/clients/${id}/regenerate-passkey`);
    return response.data;
  },
};

