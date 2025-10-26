import axios from 'axios';
import authService from './authService';

const api = axios.create({
    baseURL: 'http://localhost:8000/api', // All requests will be prefixed with /api
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add a request interceptor to include the token in headers
api.interceptors.request.use(
    (config) => {
        const user = authService.getCurrentUser();
        if (user && user.access) {
            config.headers['Authorization'] = 'Bearer ' + user.access;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default api;