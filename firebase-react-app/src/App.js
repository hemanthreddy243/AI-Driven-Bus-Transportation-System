import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { auth, database } from "./firebase";
import { ref, get } from "firebase/database";
import LandingPage from "./components/LandingPage";
import StudentAuth from "./components/StudentAuth";
import AdminAuth from "./components/AdminAuth";
import StudentDashboard from "./components/StudentDashboard";
import AdminPanel from "./components/AdminPanel";

function App() {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("App useEffect: Setting up auth state listener...");
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      console.log("Auth state changed:", currentUser ? { uid: currentUser.uid, email: currentUser.email } : "No user");

      if (currentUser) {
        setUser(currentUser);
        console.log("Fetching role for UID:", currentUser.uid);
        const userRef = ref(database, `users/${currentUser.uid}`);
        try {
          const snapshot = await get(userRef);
          if (snapshot.exists()) {
            console.log("User role fetched:", snapshot.val().role);
            setUserRole(snapshot.val().role);
          } else {
            console.log("No role data found for UID:", currentUser.uid);
            setUserRole(null);
          }
        } catch (error) {
          console.error("Error fetching user role:", error.code, error.message);
          setUserRole(null);
        }
      } else {
        console.log("No authenticated user, clearing state...");
        setUser(null);
        setUserRole(null);
      }
      console.log("Setting loading to false");
      setLoading(false);
    });

    return () => {
      console.log("App useEffect: Cleaning up auth state listener...");
      unsubscribe();
    };
  }, []);

  console.log("App render - Current state:", {
    user: user ? { uid: user.uid, email: user.email } : null,
    userRole,
    loading,
  });

  if (loading) {
    console.log("App render: Still loading, showing loading message...");
    return <p>Loading...</p>;
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/student-register" element={<StudentAuth />} />
      <Route path="/student-login" element={<StudentAuth />} />
      <Route path="/admin-login" element={<AdminAuth />} />
      <Route
        path="/student-dashboard"
        element={
          user && userRole === "student" ? (
            <StudentDashboard />
          ) : (
            <Navigate to="/student-login" />
          )
        }
      />
      <Route
        path="/admin-panel"
        element={
          user && userRole === "admin" ? (
            <AdminPanel />
          ) : (
            <Navigate to="/admin-login" />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;