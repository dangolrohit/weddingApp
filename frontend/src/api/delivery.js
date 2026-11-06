import api from './client';

export const deliveryApi = {
  // Public Verification & Preview
  verifyClient: async (credentials) => {
    const response = await api.post('/public/get-my-image/verify', credentials);
    return response.data;
  },

  getClientPhotos: async (sessionToken, page = 1) => {
    const headers = {};
    if (sessionToken) {
      headers['X-Client-Session'] = sessionToken;
    }
    const response = await api.get('/public/get-my-image/photos', {
      params: { page },
      headers,
    });
    return response.data;
  },

  requestDownloadLink: async (sessionToken, email = '') => {
    const headers = {};
    if (sessionToken) {
      headers['X-Client-Session'] = sessionToken;
    }
    const response = await api.post(
      '/public/get-my-image/request-link',
      { email },
      { headers }
    );
    return response.data;
  },

  // Public /d/{token} Portal
  getDownloadStatus: async (token) => {
    const response = await api.get(`/d/${token}`);
    return response.data;
  },

  getPartDownloadUrl: (token, partNo) => {
    return `/api/d/${token}/part/${partNo}`;
  },

  // Admin Send & Links Management
  adminSendLink: async (clientId, payload) => {
    const response = await api.post(`/admin/clients/${clientId}/send-link`, payload);
    return response.data;
  },

  adminGetClientLinks: async (clientId) => {
    const response = await api.get(`/admin/clients/${clientId}/links`);
    return response.data;
  },

  adminRevokeLink: async (linkId) => {
    const response = await api.post(`/admin/links/${linkId}/revoke`);
    return response.data;
  },
};
