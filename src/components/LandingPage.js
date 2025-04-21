import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import campusCommuteBg from "../assets/campus-commute-bg.jpg"; // Update path if filename differs

const LandingPage = () => {
  const navigate = useNavigate();

  // Inject styles and animations once
  useEffect(() => {
    if (!document.getElementById("landing-styles")) {
      const styleSheet = document.createElement("style");
      styleSheet.id = "landing-styles";
      styleSheet.type = "text/css";
      styleSheet.innerText = `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes glow {
          0% { box-shadow: 0 0 5px rgba(0, 229, 255, 0.3); }
          50% { box-shadow: 0 0 15px rgba(0, 229, 255, 0.5); }
          100% { box-shadow: 0 0 5px rgba(0, 229, 255, 0.3); }
        }
        button:hover {
          background-color: #00bcd4; // Cyan hover to match neon theme
          transform: scale(1.05);
          box-shadow: 0 4px 15px rgba(0, 229, 255, 0.6);
        }
        .content-box {
          animation: fadeIn 0.7s ease-in-out;
        }
      `;
      document.head.appendChild(styleSheet);
    }
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.contentBox}>
        <h1 style={styles.header}>Welcome to Campus Commute</h1>
        <p style={styles.subText}>Your smart ride awaits—choose your role:</p>
        <div style={styles.buttonGroup}>
          <button
            style={styles.button}
            onClick={() => navigate("/student-register")}
          >
            Student Register
          </button>
          <button
            style={styles.button}
            onClick={() => navigate("/student-login")}
          >
            Student Login
          </button>
          <button
            style={styles.button}
            onClick={() => navigate("/admin-login")}
          >
            Admin Login
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "20px",
    backgroundImage: `url(${campusCommuteBg})`,
    backgroundSize: "cover", // Ensures the image fills the viewport
    backgroundPosition: "center", // Centers the image
    backgroundRepeat: "no-repeat",
    backgroundAttachment: "fixed", // Prevents scrolling issues
    position: "relative",
    overflow: "hidden",
    fontFamily: "'Arial', sans-serif",
    backgroundColor: "#0d0d1a", // Very dark blue to match night theme
  },
  contentBox: {
    backgroundColor: "rgba(30, 30, 30, 0.9)", // Dark semi-transparent background
    padding: "45px",
    borderRadius: "15px",
    boxShadow: "0 8px 25px rgba(0, 0, 0, 0.7)", // Darker shadow for depth
    textAlign: "center",
    maxWidth: "550px",
    width: "100%",
    zIndex: 1,
    transform: "translate(25px, 25px)", // Slight down-right shift
    margin: "0 auto", // Ensures centering with transform
  },
  header: {
    fontSize: "34px",
    color: "#00e5ff", // Cyan to match neon lights
    marginBottom: "15px",
    fontWeight: "700",
    textShadow: "0 2px 6px rgba(0, 229, 255, 0.4)", // Neon glow effect
  },
  subText: {
    fontSize: "18px",
    color: "#b0bec5", // Light gray for readability
    marginBottom: "35px",
    fontStyle: "italic",
  },
  buttonGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  button: {
    padding: "14px 30px",
    fontSize: "17px",
    color: "#fff",
    backgroundColor: "#00bcd4", // Cyan to match neon theme
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "background-color 0.3s, transform 0.2s, box-shadow 0.3s",
    boxShadow: "0 3px 10px rgba(0, 229, 255, 0.4)",
    fontWeight: "600",
  },
};

export default LandingPage;