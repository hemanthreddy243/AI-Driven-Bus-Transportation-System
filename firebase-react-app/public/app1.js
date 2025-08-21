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
  
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUserRole = async (user) => {
      if (user) {
        // Fetch user details from database using Student ID instead of UID
        const userRef = ref(database, `users/${user.displayName}`); // Assuming studentID is stored in displayName
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
          setUserRole(snapshot.val()?.role);
        } else {
          setUserRole(null);
        }
      } else {
        setUserRole(null);
      }
      setLoading(false);
    };

    // Listen for authentication state changes
    const unsubscribe = auth.onAuthStateChanged((user) => {
      checkUserRole(user);
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <p>Loading...</p>;

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      
      {/* Updated correct paths for registration and login */}
      <Route path="/student-register" element={<StudentAuth />} />
      <Route path="/student-login" element={<StudentAuth />} />
      
      <Route path="/admin-login" element={<AdminAuth />} />
      
      {/* Role-based protected routes */}
      <Route
          path="/student-dashboard"
          element={
            userRole === "student" ? <StudentDashboard /> : <Navigate to="/student-auth" />
          }
        />
        <Route
          path="/admin-panel"
          element={
            userRole === "admin" ? <AdminPanel/> : <Navigate to="/admin-auth" />
          }
        />

    </Routes>
  );
}

export default App;
