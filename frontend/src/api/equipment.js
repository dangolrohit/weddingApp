import api from './client';

export const equipmentApi = {
  list: async (params = {}) => {
    const response = await api.get('/admin/equipment', { params });
    return response.data;
  },
  get: async (id) => {
    const response = await api.get(`/admin/equipment/${id}`);
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('/admin/equipment', data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.patch(`/admin/equipment/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/admin/equipment/${id}`);
    return response.data;
  },
  summary: async () => {
    const response = await api.get('/admin/equipment/summary');
    return response.data;
  },
};

