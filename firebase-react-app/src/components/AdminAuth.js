import React, { useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { ref, set, get } from "firebase/database";
import { auth, database } from "../firebase";
import { useNavigate } from "react-router-dom";

function AdminAuth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleAdminSignUp = async () => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await set(ref(database, `users/${user.uid}`), {
        email,
        role: "admin",
      });

      alert("Admin registered successfully!");
      navigate("/admin-panel");
    } catch (error) {
      alert("Registration Error: " + error.message);
    }
  };

  const handleAdminLogin = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userRef = ref(database, `users/${user.uid}`);
      const snapshot = await get(userRef);
      const userData = snapshot.val();

      if (userData?.role === "admin") {
        navigate("/admin-panel");
      } else {
        alert("Unauthorized access!");
      }
    } catch (error) {
      alert("Login Error: " + error.message);
    }
  };

  return (
    <div>
      <h2>Admin Authentication</h2>
      <input type="email" placeholder="Admin Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button onClick={handleAdminSignUp}>Register Admin</button>
      <button onClick={handleAdminLogin}>Login</button>
    </div>
  );
}

export default AdminAuth;
