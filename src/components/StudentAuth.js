import React, { useState } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { ref, set, get } from "firebase/database";
import { auth, database } from "../firebase";
import { useNavigate, useLocation } from "react-router-dom";

function StudentAuth() {
  const [name, setName] = useState("");
  const [studentID, setStudentID] = useState("");
  const [stopID, setStopID] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const isRegistering = location.pathname === "/student-register";

  const handleSignUp = async () => {
    try {
      const trimmedName = name.trim();
      const trimmedStudentID = studentID.trim();
      const trimmedStopID = stopID.trim();
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedPassword = password.trim();

      console.log("Starting registration with:", {
        name: trimmedName,
        studentID: trimmedStudentID,
        stopID: trimmedStopID,
        email: trimmedEmail,
      });

      if (!trimmedName || !trimmedStudentID || !trimmedStopID || !trimmedEmail || !trimmedPassword) {
        alert("All fields are required!");
        return;
      }

      console.log("Creating user with email:", trimmedEmail);
      const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
      const user = userCredential.user;
      console.log("User registered successfully:", { uid: user.uid, email: user.email });

      const userData = {
        name: trimmedName,
        studentID: trimmedStudentID,
        stopID: trimmedStopID,
        email: trimmedEmail,
        role: "student",
      };
      console.log("Writing data to users/", user.uid, "with:", userData);
      await set(ref(database, `users/${user.uid}`), userData);
      console.log("Data successfully written to users/", user.uid);

      alert("Student registered successfully! Redirecting to login...");
      navigate("/student-login");
    } catch (error) {
      console.error("SignUp Error:", error.code, error.message);
      alert("Registration Error: " + error.message);
    }
  };

  const handleSignIn = async () => {
    try {
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedPassword = password.trim();

      console.log("Starting login with email:", trimmedEmail);
      if (!trimmedEmail || !trimmedPassword) {
        alert("Please enter Email and Password.");
        return;
      }

      console.log("Attempting to sign in...");
      const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
      const user = userCredential.user;
      console.log("Signed in successfully:", { uid: user.uid, email: user.email });

      console.log("Fetching user data from users/", user.uid);
      const userRef = ref(database, `users/${user.uid}`);
      const snapshot = await get(userRef);
      console.log("Snapshot exists:", snapshot.exists(), "Data:", snapshot.val());

      if (!snapshot.exists()) {
        console.warn("No user data found at users/", user.uid);
        alert("User data not found! Contact support.");
        return;
      }

      const userData = snapshot.val();
      console.log("User data retrieved:", userData);

      if (userData.role === "student") {
        console.log("Role is student, navigating to dashboard...");
        setTimeout(() => navigate("/student-dashboard", { replace: true }), 100);
      } else {
        console.warn("Role is not student:", userData.role);
        alert("Unauthorized access! This is not a student account.");
      }
    } catch (error) {
      console.error("SignIn Error:", error.code, error.message);
      alert("Login Error: " + error.message);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.authBox}>
        <h2 style={styles.header}>{isRegistering ? "Student Registration" : "Student Login"}</h2>
        <form style={styles.form}>
          {isRegistering && (
            <>
              <input
                type="text"
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={styles.input}
              />
              <input
                type="text"
                placeholder="Student ID"
                value={studentID}
                onChange={(e) => setStudentID(e.target.value)}
                style={styles.input}
              />
              <input
                type="text"
                placeholder="Stop ID"
                value={stopID}
                onChange={(e) => setStopID(e.target.value)}
                style={styles.input}
              />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
              />
            </>
          )}
          {!isRegistering && (
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
            />
          )}
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
          />
          <button
            type="button"
            onClick={isRegistering ? handleSignUp : handleSignIn}
            style={styles.button}
          >
            {isRegistering ? "Register" : "Login"}
          </button>
          <p style={styles.switchText}>
            {isRegistering ? (
              <>Already have an account? <a href="/student-login" style={styles.link}>Login</a></>
            ) : (
              <>Need an account? <a href="/student-register" style={styles.link}>Register</a></>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "20px",
    backgroundImage: "url('https://images.unsplash.com/photo-1503984107770-9c18f4323f34?q=80&w=2070&auto=format&fit=crop')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    fontFamily: "'Arial', sans-serif",
  },
  authBox: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    padding: "30px",
    borderRadius: "10px",
    boxShadow: "0 4px 15px rgba(0, 0, 0, 0.2)",
    width: "100%",
    maxWidth: "400px",
    animation: "fadeIn 0.5s ease-in-out",
  },
  header: {
    fontSize: "26px",
    color: "#2c3e50",
    textAlign: "center",
    marginBottom: "20px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "15px",
  },
  input: {
    padding: "10px",
    fontSize: "15px",
    color: "#34495e",
    border: "1px solid #ddd",
    borderRadius: "5px",
    outline: "none",
    transition: "border-color 0.3s, box-shadow 0.3s",
  },
  inputFocus: {
    borderColor: "#3498db",
    boxShadow: "0 0 5px rgba(52, 152, 219, 0.5)",
  },
  button: {
    padding: "10px",
    fontSize: "15px",
    color: "#fff",
    backgroundColor: "#3498db",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    transition: "background-color 0.3s, transform 0.2s",
  },
  buttonHover: {
    backgroundColor: "#2980b9",
    transform: "scale(1.02)",
  },
  switchText: {
    fontSize: "13px",
    color: "#34495e",
    textAlign: "center",
    marginTop: "10px",
  },
  link: {
    color: "#3498db",
    textDecoration: "none",
    fontWeight: "bold",
  },
};

// Add CSS keyframes for animation
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-20px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;
document.head.appendChild(styleSheet);

export default StudentAuth;