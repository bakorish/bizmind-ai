import axios from 'axios';

const client = axios.create({ baseURL: '/api' });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('bizmind_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response && err.response.status === 401 && !location.pathname.startsWith('/login')) {
      localStorage.removeItem('bizmind_token');
      localStorage.removeItem('bizmind_user');
      location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const errMsg = (e) =>
  (e.response && e.response.data && (e.response.data.message ||
    (e.response.data.errors && e.response.data.errors.map((x) => x.message).join('; ')))) ||
  e.message || 'Something went wrong';

export default client;
