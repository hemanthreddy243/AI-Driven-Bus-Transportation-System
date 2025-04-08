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
    <div>
      <h2>{isRegistering ? "Student Registration" : "Student Login"}</h2>
      {isRegistering && (
        <>
          <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input type="text" placeholder="Student ID" value={studentID} onChange={(e) => setStudentID(e.target.value)} />
          <input type="text" placeholder="Stop ID" value={stopID} onChange={(e) => setStopID(e.target.value)} />
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </>
      )}
      {!isRegistering && (
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      )}
      <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {isRegistering ? (
        <button onClick={handleSignUp}>Register</button>
      ) : (
        <button onClick={handleSignIn}>Login</button>
      )}
    </div>
  );
}

export default StudentAuth;