import api from './client';

export const publicApi = {
  getCategories: async () => {
    const response = await api.get('/public/categories');
    return response.data;
  },

  getShowcase: async (categorySlug = '') => {
    const params = {};
    if (categorySlug && categorySlug !== 'all') {
      params.category = categorySlug;
    }
    const response = await api.get('/public/showcase', { params });
    return response.data;
  },

  getBranding: async () => {
    const response = await api.get('/public/branding');
    return response.data;
  },

  submitInquiry: async (inquiryData) => {
    const response = await api.post('/public/inquiries', inquiryData);
    return response.data;
  },
};

