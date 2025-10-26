import axios from 'axios';

const API_URL = 'http://localhost:8000/api/'; // Django backend endpoint

// ✅ Register a new user
const register = ({ username, email, password, password2, role }) => {
  return axios.post(API_URL + 'register/', {
    username,
    email,
    password,
    password2, // ✅ include password2 properly
    role,
  });
};

// ✅ Login existing user
const login = (username, password) => {
  return axios
    .post(API_URL + 'token/', {
      username,
      password,
    })
    .then((response) => {
      if (response.data.access) {
        localStorage.setItem('user', JSON.stringify(response.data));
      }
      return response.data;
    });
};

// ✅ Logout user
const logout = () => {
  localStorage.removeItem('user');
};

// ✅ Get current logged-in user
const getCurrentUser = () => {
  return JSON.parse(localStorage.getItem('user'));
};

const authService = {
  register,
  login,
  logout,
  getCurrentUser,
};

export default authService;
