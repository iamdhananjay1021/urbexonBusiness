// import axios from 'axios';

// const api = axios.create({
//     baseURL: import.meta.env.VITE_API_URL || 'http://localhost:9000/api',
//     withCredentials: true,
// });

// api.interceptors.request.use(
//     (config) => {
//         const token = localStorage.getItem('vendorToken');
//         if (token) {
//             config.headers.Authorization = `Bearer ${token}`;
//         }
//         return config;
//     },
//     (error) => Promise.reject(error)
// );

// api.interceptors.response.use(
//     (response) => response,
//     (error) => {
//         if (error.response?.status === 401) {
//             localStorage.removeItem('vendorToken');
//             window.location.href = '/login';
//         }
//         return Promise.reject(error);
//     }
// );

// export default api;


/**
 * api/axios.js — Production, final
 *
 * Single responsibility: create the shared axios instance. ALL auth logic
 * (attaching the token, silent refresh-on-401, logout) lives in
 * AuthContext.jsx — this file must never add its own interceptors here.
 * (Previously it did, and conflicted with AuthContext.jsx's interceptors,
 * causing an infinite 401 → hard-redirect → remount → 401 loop.)
 */
import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:9000/api",
    withCredentials: true, // required — sends/receives the httpOnly refreshToken cookie
});

export default api;
