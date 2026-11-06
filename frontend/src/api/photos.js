import api from './client';

export const photosApi = {
  list: async (clientId) => {
    const response = await api.get(`/admin/clients/${clientId}/photos`);
    return response.data;
  },

  upload: async (clientId, file, onUploadProgress) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/admin/clients/${clientId}/photos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onUploadProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onUploadProgress(percentCompleted);
        }
      },
    });
    return response.data;
  },

  update: async (photoId, data) => {
    const response = await api.patch(`/admin/photos/${photoId}`, data);
    return response.data;
  },

  delete: async (photoId) => {
    const response = await api.delete(`/admin/photos/${photoId}`);
    return response.data;
  },

  reorder: async (clientId, photoOrders) => {
    const response = await api.post(`/admin/clients/${clientId}/photos/reorder`, {
      photo_orders: photoOrders,
    });
    return response.data;
  },

  updateShowcase: async (clientId, photoIds) => {
    const response = await api.put(`/admin/clients/${clientId}/showcase`, {
      photo_ids: photoIds,
    });
    return response.data;
  },
};
