import axios from "axios";

// ======================================================
// API BASE URL
// ======================================================

// Local development:
// VITE_API_URL=http://localhost:5000/api

// Production:
// VITE_API_URL=https://your-backend-url.onrender.com/api

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";

const api = axios.create({
baseURL: "https://food-delivery-project-403f.onrender.com/api",
  headers: {
    "Content-Type": "application/json",
  },

  timeout: 15000,
});

// ======================================================
// REQUEST INTERCEPTOR
// ======================================================

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers = config.headers || {};

      config.headers.Authorization =
        `Bearer ${token}`;
    }

    return config;
  },

  (error) => {
    return Promise.reject(error);
  }
);

// ======================================================
// RESPONSE INTERCEPTOR
// ======================================================

api.interceptors.response.use(
  (response) => {
    return response;
  },

  (error) => {
    // No response from server
    if (!error.response) {
      console.error(
        "API Error: Unable to connect to server",
        error.message
      );

      return Promise.reject(error);
    }

    const status = error.response.status;
    const message =
      error.response.data?.message || "";

    console.error(
      `API Error ${status}:`,
      error.response.data
    );

    // ==================================================
    // 401 UNAUTHORIZED
    // ==================================================

    if (status === 401) {
      console.warn(
        "401 Unauthorized:",
        message
      );

      const lowerMessage =
        message.toLowerCase();

      const isAuthError =
        lowerMessage.includes("token") ||
        lowerMessage.includes("authorized") ||
        lowerMessage.includes("authentication") ||
        lowerMessage.includes("jwt");

      if (isAuthError) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");

        // Redirect only if user is not already
        // on login/register page
        const currentPath =
          window.location.pathname;

        if (
          currentPath !== "/login" &&
          currentPath !== "/register"
        ) {
          window.location.href = "/login";
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;