import api from './client';

export const albumsApi = {
  // Admin Album Endpoints
  listClientAlbums: async (clientId) => {
    const response = await api.get(`/admin/clients/${clientId}/albums`);
    return response.data;
  },

  createClientAlbum: async (clientId, data) => {
    const response = await api.post(`/admin/clients/${clientId}/albums`, data);
    return response.data;
  },

  getAlbum: async (albumId) => {
    const response = await api.get(`/admin/albums/${albumId}`);
    return response.data;
  },

  updateAlbum: async (albumId, data) => {
    const response = await api.patch(`/admin/albums/${albumId}`, data);
    return response.data;
  },

  deleteAlbum: async (albumId) => {
    const response = await api.delete(`/admin/albums/${albumId}`);
    return response.data;
  },

  generateShareLink: async (albumId, expiresInDays = 30) => {
    const response = await api.post(`/admin/albums/${albumId}/share-link`, {
      expires_in_days: expiresInDays
    });
    return response.data;
  },

  revokeShareLink: async (albumId) => {
    const response = await api.post(`/admin/albums/${albumId}/revoke-share`);
    return response.data;
  },

  listAlbumMedia: async (albumId, params = {}) => {
    const response = await api.get(`/admin/albums/${albumId}/media`, { params });
    return response.data;
  },

  // Direct S3 Upload Preparation & Signing
  prepareMediaUpload: async (albumId, data) => {
    const response = await api.post(`/admin/albums/${albumId}/media/prepare`, data);
    return response.data;
  },

  signS3Request: async (albumId, requestData) => {
    const response = await api.post(`/admin/albums/${albumId}/s3-sign`, requestData);
    return response.data;
  },

  completeMediaUpload: async (albumId, mediaId) => {
    const response = await api.post(`/admin/albums/${albumId}/media/${mediaId}/complete`);
    return response.data;
  },

  abortMediaUpload: async (albumId, mediaId) => {
    const response = await api.post(`/admin/albums/${albumId}/media/${mediaId}/abort`);
    return response.data;
  },

  deleteAlbumMedia: async (albumId, mediaId) => {
    const response = await api.delete(`/admin/albums/${albumId}/media/${mediaId}`);
    return response.data;
  },

  // Public Client Album Endpoints
  getClientAlbum: async (shareToken, page = 1) => {
    const response = await api.get(`/client/albums/${shareToken}`, {
      params: { page }
    });
    return response.data;
  },

  getClientDownloadUrl: async (shareToken, mediaId) => {
    const response = await api.get(`/client/albums/${shareToken}/media/${mediaId}/download`);
    return response.data;
  },

  getClientPreviewUrl: async (shareToken, mediaId) => {
    const response = await api.get(`/client/albums/${shareToken}/media/${mediaId}/preview`);
    return response.data;
  },
};

