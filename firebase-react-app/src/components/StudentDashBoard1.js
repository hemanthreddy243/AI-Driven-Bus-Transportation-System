import React, { useState, useEffect } from "react";
import { auth, database } from "../firebase";
import { ref, onValue, set } from "firebase/database";
import { useNavigate } from "react-router-dom";

const StudentDashboard = () => {
  const [studentInfo, setStudentInfo] = useState(null);
  const [coming, setComing] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [busRouteImage, setBusRouteImage] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      const studentRef = ref(database, `users/${user.uid}`);
      onValue(studentRef, (snapshot) => {
        const data = snapshot.val();
        setStudentInfo(data);
        setComing(data.coming || null);
      });
    }

    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const isVotingTime = () => {
    const hours = currentTime.getHours();
    return hours >= 17 && hours < 22; // 5 PM to 10 PM
  };

  const handleComingResponse = async (response) => {
    if (!isVotingTime()) {
      alert("You can only respond between 5 PM and 10 PM.");
      return;
    }
    const user = auth.currentUser;
    if (user) {
      await set(ref(database, `users/${user.uid}/coming`), response);
      setComing(response);
      alert(`You selected: ${response}`);
    }
  };

  useEffect(() => {
    const checkTimeAndFetchGraph = async () => {
      const hours = currentTime.getHours();
      if (hours >= 22) {
        try {
          const response = await fetch("http://localhost:5000/api/generate-routes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ timestamp: currentTime.toISOString() }),
          });
          if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
          }
          const data = await response.json();
          setBusRouteImage(data.imageUrl);
        } catch (error) {
          console.error("Error fetching bus routes:", error);
        }
      }
    };
    checkTimeAndFetchGraph();
  }, [currentTime]);

  const handleLogout = async () => {
    await auth.signOut();
    navigate("/student-login");
  };

  return (
    <div>
      <h2>Student Dashboard</h2>
      {studentInfo ? (
        <div>
          <p><strong>Name:</strong> {studentInfo.name}</p>
          <p><strong>Student ID:</strong> {studentInfo.studentID}</p>
          <p><strong>Stop ID:</strong> {studentInfo.stopID}</p>

          <div>
            <h3>Are you coming tomorrow?</h3>
            {coming === null ? (
              <>
                <button onClick={() => handleComingResponse("Yes")}>Yes</button>
                <button onClick={() => handleComingResponse("No")}>No</button>
              </>
            ) : (
              <p>You selected: {coming}</p>
            )}
            {!isVotingTime() && <p>Voting is only available between 5 PM and 10 PM.</p>}
          </div>

          {busRouteImage && currentTime.getHours() >= 22 && (
            <div>
              <h3>Bus Routes</h3>
              <img src={busRouteImage} alt="Bus Routes Graph" style={{ maxWidth: "100%" }} />
            </div>
          )}
        </div>
      ) : (
        <p>Loading...</p>
      )}
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
};

export default StudentDashboard;