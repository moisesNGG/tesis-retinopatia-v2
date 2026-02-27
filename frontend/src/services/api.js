/**
 * API Service - Servicios para comunicación con el backend
 * CONECTADO AL BACKEND REAL
 */

// IMPORTANTE: Siempre usar window.location.origin en producción
// process.env.REACT_APP_API_BASE_URL solo para desarrollo local
const API_BASE_URL = (
  typeof window !== 'undefined' && 
  window.location.hostname !== 'localhost' &&
  window.location.hostname !== '127.0.0.1'
) 
  ? `${window.location.origin}/api`  // Producción: usar URL actual
  : process.env.REACT_APP_API_BASE_URL || `${window.location.origin}/api`;  // Desarrollo: usar env o fallback

// Debug: imprimir la URL que se está usando
console.log('[API] Hostname:', window.location.hostname);
console.log('[API] window.location.origin:', window.location.origin);
console.log('[API] process.env.REACT_APP_API_BASE_URL:', process.env.REACT_APP_API_BASE_URL);
console.log('[API] API_BASE_URL final:', API_BASE_URL);

// Test debug endpoint
fetch(`${window.location.origin}/api/debug`)
  .then(r => r.json())
  .then(d => console.log('[API] Debug endpoint response:', d))
  .catch(e => console.error('[API] Debug endpoint error:', e));

// Helper para hacer requests
const fetchWithAuth = async (url, options = {}) => {
  const token = localStorage.getItem('authToken');

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Error desconocido' }));
    throw new Error(error.message || 'Error en la petición');
  }

  return response.json();
};

// ============================================
// AUTH - Autenticación
// ============================================

export const authAPI = {
  login: async (credentials) => {
    const response = await fetchWithAuth(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify(credentials)
    });

    return {
      token: response.access_token,
      user: response.user
    };
  },

  logout: async () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  }
};

// ============================================
// PAGES - Manejo de páginas CMS
// ============================================

export const pagesAPI = {
  getAll: async () => {
    return fetchWithAuth(`${API_BASE_URL}/pages`);
  },

  getBySlug: async (slug) => {
    return fetchWithAuth(`${API_BASE_URL}/pages/${slug}`);
  },

  update: async (slug, data) => {
    return fetchWithAuth(`${API_BASE_URL}/pages/${slug}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }
};

// ============================================
// PREDICTION - Análisis de imágenes con IA
// ============================================

export const predictionAPI = {
  analyze: async (imageFile) => {
    const formData = new FormData();
    formData.append('image', imageFile);

    // Usar window.location.origin para producción
    const AI_MODEL_URL = process.env.REACT_APP_AI_MODEL_URL || `${window.location.origin}/api/predict/`;

    const response = await fetch(AI_MODEL_URL, {
      method: 'POST',
      body: formData,
      headers: {
        // NO incluir Content-Type para que el browser lo setee automáticamente con boundary
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Error en el análisis de la imagen');
    }

    return response.json();
  },

  analyzeCustomModel: async (imageFile) => {
    const formData = new FormData();
    formData.append('image', imageFile);

    const CUSTOM_MODEL_URL = `${window.location.origin}/api/predict/custom-model`;

    const response = await fetch(CUSTOM_MODEL_URL, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Error en el analisis con modelo personalizado');
    }

    return response.json();
  },

  downloadReport: async (imageFile) => {
    const formData = new FormData();
    formData.append('image', imageFile);

    const REPORT_URL = `${window.location.origin}/api/predict/report`;

    const response = await fetch(REPORT_URL, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Error al generar el reporte');
    }

    return response.blob();
  }
};

// ============================================
// MODELS - Metricas de modelos
// ============================================

export const modelsAPI = {
  getAllMetrics: async () => {
    return fetchWithAuth(`${API_BASE_URL}/models/metrics`);
  },

  getModelMetrics: async (modelKey) => {
    return fetchWithAuth(`${API_BASE_URL}/models/metrics/${modelKey}`);
  }
};

// ============================================
// UI TEXTS - Textos reutilizables (no implementado en backend aún)
// ============================================

export const uiTextsAPI = {
  getAll: async () => {
    // Por ahora mock - puedes implementar en el backend si lo necesitas
    return Promise.resolve([
      { key: 'upload_button_text', value: 'Subir imagen y analizar', category: 'button' },
      { key: 'hero_cta', value: 'Comenzar Análisis', category: 'button' }
    ]);
  },

  update: async (key, value) => {
    console.log('Actualizando texto UI:', key, value);
    return Promise.resolve({ success: true });
  }
};

export default {
  auth: authAPI,
  pages: pagesAPI,
  prediction: predictionAPI,
  models: modelsAPI,
  uiTexts: uiTextsAPI
};
