import { useState, useEffect, useCallback, useRef } from "react";
import axios from "../api/axios";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getToken, isActiveWithinHours, setLastActive } from "../utils/auth";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();
  const redirectTo = location.state?.from || "/dashboard";
  const firstInputRef = useRef(null);
  const abortControllerRef = useRef(null);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({});

  useEffect(() => {
    const token = getToken();
    if ((token && isActiveWithinHours(48)) || isAuthenticated) {
      navigate(redirectTo, { replace: true });
    } else {
      setTimeout(() => firstInputRef.current?.focus(), 100);
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [isAuthenticated, navigate, redirectTo]);

  useEffect(() => {
    if (location.state?.message) {
      setGeneralError(location.state.message);
    }
  }, [location.state]);

  const validateField = useCallback((name, value) => {
    const error = {};

    switch (name) {
      case "email":
        if (!value.trim()) {
          error.email = "Email address is required";
        } else if (!/\S+@\S+\.\S+/.test(value)) {
          error.email = "Please enter a valid email address";
        }
        break;
      case "password":
        if (!value) {
          error.password = "Password is required";
        } else if (value.length < 6) {
          error.password = "Password must be at least 6 characters";
        }
        break;
    }

    return error;
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setGeneralError("");

    if (touched[name]) {
      const fieldError = validateField(name, value);
      setErrors(prev => ({ ...prev, ...fieldError }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    const fieldError = validateField(name, value);
    setErrors(prev => ({ ...prev, ...fieldError }));
  };

  const validateForm = useCallback(() => {
    const emailError = validateField("email", formData.email);
    const passwordError = validateField("password", formData.password);
    const allErrors = { ...emailError, ...passwordError };

    setErrors(allErrors);
    setTouched({ email: true, password: true });

    return Object.keys(allErrors).length === 0;
  }, [formData, validateField]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (isLoading) return;

    setGeneralError("");

    if (!validateForm()) return;

    setIsLoading(true);

    abortControllerRef.current = new AbortController();

    try {
      const res = await axios.post("/auth/login", {
        email: formData.email.trim(),
        password: formData.password
      }, {
        signal: abortControllerRef.current.signal,
        timeout: 15000
      });

      login(res.data.token);
      localStorage.setItem("hasPaid", String(res.data.payment ?? false));
      setLastActive();

      setTimeout(() => {
        navigate(redirectTo, { replace: true });
      }, 800);

    } catch (err) {
      if (err.name === 'CanceledError') return;

      console.error("Login error:", err);

      if (!navigator.onLine) {
        setGeneralError("No internet connection. Please check your network.");
      } else if (err.code === 'ECONNABORTED') {
        setGeneralError("Request timed out. Please try again.");
      } else if (err.response) {
        const status = err.response.status;
        const message = err.response.data?.message || "Login failed";

        if (status === 401) {
          setGeneralError("Invalid credentials. Please check your email/phone and password.");
        } else if (status === 404) {
          setGeneralError("Account not found. Would you like to sign up instead?");
          setTimeout(() => navigate("/signup", { state: { from: redirectTo } }), 3000);
        } else if (status === 429) {
          setGeneralError("Too many login attempts. Please try again later.");
        } else {
          setGeneralError(message);
        }
      } else {
        setGeneralError("Server is unavailable. Please try again later.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-background">
        <div className="auth-bg-gradient"></div>
      </div>

      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">Welcome Back</h1>
          <p className="auth-subtitle">Sign in to continue your learning journey</p>
        </div>

        {generalError && (
          <div className="auth-message error" role="alert" style={{background: '#ffebee', borderLeftColor: '#f44336', color: '#c62828'}}>
            <span>⚠</span> {generalError}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="input-group">
            <input
              ref={firstInputRef}
              id="email"
              className={`${errors.email && touched.email ? 'error' : ''}`}
              name="email"
              type="email"
              autoComplete="email"
              value={formData.email}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={isLoading}
              placeholder="Enter your email address"
              aria-invalid={!!(errors.email && touched.email)}
              aria-describedby={errors.email ? "email-error" : undefined}
            />
            {errors.email && touched.email && (
              <span className="error-text" role="alert">
                {errors.email}
              </span>
            )}
          </div>

          <div className="input-group">
            <div className="password-input-wrapper">
              <input
                id="password"
                className={`${errors.password && touched.password ? 'error' : ''}`}
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={formData.password}
                onChange={handleChange}
                onBlur={handleBlur}
                disabled={isLoading}
                placeholder="Enter your password"
                aria-invalid={!!(errors.password && touched.password)}
                aria-describedby={errors.password ? "password-error" : undefined}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(prev => !prev)}
                disabled={isLoading}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
            {errors.password && touched.password && (
              <span className="error-text" role="alert">
                {errors.password}
              </span>
            )}
          </div>

          <div style={{textAlign: 'right', margin: '-8px 0 8px 0'}}>
            <Link to="/forgot-password" className="auth-link">
              Forgot password?
            </Link>
          </div>

          <button
            className="auth-button"
            type="submit"
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {isLoading ? (
              <>
                <span className="loading-spinner"></span>
                Signing In...
              </>
            ) : (
              "Login"
            )}
          </button>
        </form>

        <div className="auth-toggle">
          <p>
            Don't have an account?
            <Link to="/signup" state={{ from: redirectTo }} className="toggle-button"> Sign up here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}