import React from "react";
import { useNavigate } from "react-router-dom";


const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="landing-container">
      <h1>Welcome to the Role-Based App</h1>
      <p>Choose your role:</p>
      <div className="button-group">
        <button onClick={() => navigate("/student-register")}>Student Register</button>
        <button onClick={() => navigate("/student-login")}>Student Login</button>
        <button onClick={() => navigate("/admin-login")}>Admin Login</button>
      </div>
    </div>
  );
};

export default LandingPage;
