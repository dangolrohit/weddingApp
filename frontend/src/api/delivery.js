import api from './client';

export const deliveryApi = {
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
};
