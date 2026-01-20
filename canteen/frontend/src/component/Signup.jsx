import { useState } from "react";
import axios from "axios";
import "./Signup.css";

export default function Signup() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: ""
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const validate = () => {
    if (form.name.length < 3)
      return "Name must be at least 3 characters";

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(form.email))
      return "Enter a valid email";

    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(form.phone))
      return "Enter a valid 10-digit Indian phone number";

    if (form.password.length < 6)
      return "Password must be at least 6 characters";

    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Clear previous messages
    setError("");
    setSuccess("");
    
    // Validate form
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      console.log("Sending signup request...");
      const res = await axios.post(
        "http://localhost:5000/auth/signup",
        form
      );

      console.log("Signup response:", res.data);
      
      setSuccess(res.data.message || "Signup successful!");
      setError("");
      
      // Clear form after successful signup
      setForm({ name: "", email: "", phone: "", password: "" });
      
    } catch (err) {
      console.error("Signup error:", err);
      
      // Handle different error scenarios
      if (err.response) {
        // Server responded with error status (4xx, 5xx)
        const errorMsg = err.response.data?.error || 
                        err.response.data?.message || 
                        "Signup failed. Please try again.";
        setError(errorMsg);
      } else if (err.request) {
        // Request was made but no response received
        setError("Cannot connect to server. Please check if the server is running.");
      } else {
        // Something else happened
        setError("An unexpected error occurred. Please try again.");
      }
      
      setSuccess("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-container">
      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}

      <form onSubmit={handleSubmit} className="signup-form">
        {/* Logo and header now inside the form */}
        <div className="form-header">
          <div className="logo">
            <img 
              src='/img.png' 
              alt="CampusBites Logo"
              className="logo-image"
            />
          </div>
          <h2>Join CampusBites</h2>
          <p className="signup-subtitle">Create your account to order delicious meals and enjoy campus dining!</p>
        </div>

        <input
          type="text"
          placeholder="Full Name"
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          disabled={loading}
          required
        />

        <input
          type="email"
          placeholder="Email Address"
          value={form.email}
          onChange={e => setForm({ ...form, email: e.target.value })}
          disabled={loading}
          required
        />

        <input
          type="text"
          placeholder="Phone Number"
          value={form.phone}
          onChange={e => setForm({ ...form, phone: e.target.value })}
          disabled={loading}
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={e => setForm({ ...form, password: e.target.value })}
          disabled={loading}
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? "Signing up..." : "Sign Up"}
        </button>
      </form>
    </div>
  );
}