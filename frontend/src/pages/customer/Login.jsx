import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");

    // Basic validation
    if (!form.email.trim()) {
      setError("Please enter your email.");
      return;
    }

    if (!form.password) {
      setError("Please enter your password.");
      return;
    }

    try {
      setLoading(true);

      const response = await api.post("/auth/login", {
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });

      console.log("Login response:", response.data);

      // Make sure backend returned token
      if (!response.data?.token) {
        setError("Login failed: authentication token not received.");
        return;
      }

      // Save user + token through AuthContext
      login(response.data);

      console.log(
        "Token saved:",
        localStorage.getItem("token")
      );

      console.log(
        "User saved:",
        localStorage.getItem("user")
      );

      // Go to restaurants after successful login
      navigate("/restaurants", { replace: true });

    } catch (err) {
      console.error("Login error:", err);

      if (err.response) {
        setError(
          err.response.data?.message ||
            "Invalid email or password."
        );
      } else if (err.request) {
        setError(
          "Unable to connect to server. Make sure backend is running."
        );
      } else {
        setError(
          "Something went wrong. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">

      <div className="auth-card">

        <h1>Welcome Back</h1>

        <p>
          Login to your Food Delivery account
        </p>

        {/* Error */}
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>

          {/* Email */}
          <div className="form-group">

            <label htmlFor="email">
              Email
            </label>

            <input
              id="email"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="Enter your email"
              autoComplete="email"
              disabled={loading}
              required
            />

          </div>

          {/* Password */}
          <div className="form-group">

            <label htmlFor="password">
              Password
            </label>

            <input
              id="password"
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Enter your password"
              autoComplete="current-password"
              disabled={loading}
              required
            />

          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Logging in..."
              : "Login"}
          </button>

        </form>

        {/* Register */}
        <p className="auth-link">

          Don't have an account?{" "}

          <span
            onClick={() => {
              if (!loading) {
                navigate("/register");
              }
            }}
          >
            Register
          </span>

        </p>


      </div>

    </div>
  );
};

export default Login;