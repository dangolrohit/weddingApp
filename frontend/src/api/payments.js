import api from './client';

export const paymentsApi = {
  list: async (params = {}) => {
    const response = await api.get('/admin/payments', { params });
    return response.data;
  },
  get: async (id) => {
    const response = await api.get(`/admin/payments/${id}`);
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('/admin/payments', data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.patch(`/admin/payments/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/admin/payments/${id}`);
    return response.data;
  },
  summary: async () => {
    const response = await api.get('/admin/payments/summary');
    return response.data;
  },
  getClientPayments: async (clientId) => {
    const response = await api.get(`/admin/clients/${clientId}/payments`);
    return response.data;
  },
};
