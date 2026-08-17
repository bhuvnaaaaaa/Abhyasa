import { useState, useCallback, useRef, useEffect } from "react";
import axios from "../api/axios";
import { Link, useNavigate } from "react-router-dom";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const firstInputRef = useRef(null);
  const abortControllerRef = useRef(null);

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [touched, setTouched] = useState({});
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    setTimeout(() => firstInputRef.current?.focus(), 100);
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const validateEmail = useCallback((value) => {
    if (!value.trim()) {
      return "Email is required";
    }
    if (!/\S+@\S+\.\S+/.test(value)) {
      return "Please enter a valid email address";
    }
    return null;
  }, []);

  const validateOtp = useCallback((value) => {
    if (!value.trim()) {
      return "OTP is required";
    }
    if (value.length !== 6 || !/^\d+$/.test(value)) {
      return "OTP must be 6 digits";
    }
    return null;
  }, []);

  const validatePassword = useCallback((value) => {
    if (!value) {
      return "Password is required";
    }
    if (value.length < 6) {
      return "Password must be at least 6 characters";
    }
    return null;
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setGeneralError("");
    setSuccessMessage("");

    if (name === "email") setEmail(value);
    if (name === "otp") setOtp(value.replace(/\D/g, '').slice(0, 6));
    if (name === "newPassword") setNewPassword(value);
    if (name === "confirmPassword") setConfirmPassword(value);

    if (touched[name]) {
      let error = null;
      if (name === "email") error = validateEmail(value);
      if (name === "otp") error = validateOtp(value);
      if (name === "newPassword") error = validatePassword(value);
      
      setErrors(prev => ({ ...prev, [name]: error }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    
    let error = null;
    if (name === "email") error = validateEmail(value);
    if (name === "otp") error = validateOtp(value);
    if (name === "newPassword") error = validatePassword(value);
    
    setErrors(prev => ({ ...prev, [name]: error }));
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    
    const emailError = validateEmail(email);
    if (emailError) {
      setErrors({ email: emailError });
      setTouched({ email: true });
      return;
    }

    setIsLoading(true);
    setGeneralError("");

    abortControllerRef.current = new AbortController();

    try {
      await axios.post("/auth/forgot-password", {
        email: email.trim().toLowerCase()
      }, {
        signal: abortControllerRef.current.signal,
        timeout: 15000
      });

      setSuccessMessage("If an account exists with this email, an OTP has been sent");
      setStep(2);
      setResendCooldown(60);
      
    } catch (err) {
      if (err.name === 'CanceledError') return;

      if (!navigator.onLine) {
        setGeneralError("No internet connection. Please check your network.");
      } else if (err.code === 'ECONNABORTED') {
        setGeneralError("Request timed out. Please try again.");
      } else if (err.response?.status === 429) {
        setGeneralError("Too many requests. Please try again later.");
      } else {
        setGeneralError(err.response?.data?.message || "Failed to send OTP");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();

    const otpError = validateOtp(otp);
    const passwordError = validatePassword(newPassword);
    
    const allErrors = {};
    if (otpError) allErrors.otp = otpError;
    if (passwordError) allErrors.newPassword = passwordError;
    
    if (newPassword !== confirmPassword) {
      allErrors.confirmPassword = "Passwords do not match";
    }

    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      setTouched({ otp: true, newPassword: true, confirmPassword: true });
      return;
    }

    setIsLoading(true);
    setGeneralError("");

    abortControllerRef.current = new AbortController();

    try {
      await axios.post("/auth/verify-otp", {
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
        newPassword: newPassword
      }, {
        signal: abortControllerRef.current.signal,
        timeout: 15000
      });

      navigate("/login", { 
        state: { message: "Password reset successfully! You can now login with your new password." } 
      });

    } catch (err) {
      if (err.name === 'CanceledError') return;

      if (!navigator.onLine) {
        setGeneralError("No internet connection. Please check your network.");
      } else if (err.code === 'ECONNABORTED') {
        setGeneralError("Request timed out. Please try again.");
      } else if (err.response?.status === 429) {
        setGeneralError("Too many attempts. Please try again later.");
      } else {
        const message = err.response?.data?.message || "Failed to verify OTP";
        setGeneralError(message);
        
        if (message.includes("expired")) {
          setStep(1);
          setOtp("");
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    
    setIsLoading(true);
    setGeneralError("");

    try {
      await axios.post("/auth/forgot-password", {
        email: email.trim().toLowerCase()
      });

      setSuccessMessage("OTP resent successfully");
      setResendCooldown(60);
      
    } catch (err) {
      setGeneralError(err.response?.data?.message || "Failed to resend OTP");
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
          <h1 className="auth-title">Reset Password</h1>
          <p className="auth-subtitle">
            {step === 1 
              ? "Enter your email address to receive an OTP" 
              : "Enter the OTP sent to your email and set a new password"}
          </p>
        </div>

        {generalError && (
          <div className="auth-message error" role="alert" style={{background: '#ffebee', borderLeftColor: '#f44336', color: '#c62828'}}>
            <span>⚠</span> {generalError}
          </div>
        )}

        {successMessage && (
          <div className="auth-message success" role="alert" style={{background: '#e8f5e9', borderLeftColor: '#4caf50', color: '#2e7d32'}}>
            <span>✓</span> {successMessage}
          </div>
        )}

        {step === 1 ? (
          <form className="auth-form" onSubmit={handleForgotPassword} noValidate>
            <div className="input-group">
              <input
                ref={firstInputRef}
                id="email"
                className={`${errors.email && touched.email ? 'error' : ''}`}
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={handleChange}
                onBlur={handleBlur}
                disabled={isLoading}
                placeholder="Enter your email address"
                aria-invalid={!!(errors.email && touched.email)}
              />
              {errors.email && touched.email && (
                <span className="error-text" role="alert">
                  {errors.email}
                </span>
              )}
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
                  Sending OTP...
                </>
              ) : (
                "Send OTP"
              )}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleVerifyOtp} noValidate>
            <div className="input-group">
              <input
                ref={firstInputRef}
                id="otp"
                className={`${errors.otp && touched.otp ? 'error' : ''}`}
                name="otp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={handleChange}
                onBlur={handleBlur}
                disabled={isLoading}
                placeholder="Enter 6-digit OTP"
                aria-invalid={!!(errors.otp && touched.otp)}
              />
              {errors.otp && touched.otp && (
                <span className="error-text" role="alert">
                  {errors.otp}
                </span>
              )}
            </div>

            <div style={{textAlign: 'right', margin: '-8px 0 16px 0'}}>
              <button 
                type="button" 
                className="auth-link" 
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || isLoading}
                style={{background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '14px'}}
              >
                {resendCooldown > 0 
                  ? `Resend OTP (${resendCooldown}s)` 
                  : "Resend OTP"}
              </button>
            </div>

            <div className="input-group">
              <input
                id="newPassword"
                className={`${errors.newPassword && touched.newPassword ? 'error' : ''}`}
                name="newPassword"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={handleChange}
                onBlur={handleBlur}
                disabled={isLoading}
                placeholder="Enter new password"
                aria-invalid={!!(errors.newPassword && touched.newPassword)}
              />
              {errors.newPassword && touched.newPassword && (
                <span className="error-text" role="alert">
                  {errors.newPassword}
                </span>
              )}
            </div>

            <div className="input-group">
              <input
                id="confirmPassword"
                className={`${errors.confirmPassword && touched.confirmPassword ? 'error' : ''}`}
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={handleChange}
                onBlur={handleBlur}
                disabled={isLoading}
                placeholder="Confirm new password"
                aria-invalid={!!(errors.confirmPassword && touched.confirmPassword)}
              />
              {errors.confirmPassword && touched.confirmPassword && (
                <span className="error-text" role="alert">
                  {errors.confirmPassword}
                </span>
              )}
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
                  Resetting Password...
                </>
              ) : (
                "Reset Password"
              )}
            </button>
          </form>
        )}

        <div className="auth-toggle">
          <p>
            <Link to="/login" className="toggle-button">← Back to Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}