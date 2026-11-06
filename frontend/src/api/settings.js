import api from './client';

export const settingsApi = {
  get: async () => {
    const response = await api.get('/admin/settings');
    return response.data;
  },
  update: async (data) => {
    const response = await api.put('/admin/settings', data);
    return response.data;
  },
  uploadWatermarkImage: async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await api.post('/admin/settings/watermark-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  uploadBrandingLogo: async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await api.post('/admin/settings/branding-logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};

