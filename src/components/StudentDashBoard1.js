import React, { useState, useEffect, useRef } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { auth, database } from "../firebase";
import { ref, onValue, set } from "firebase/database";
import { useNavigate } from "react-router-dom";

const StudentDashboard = () => {
  const [studentInfo, setStudentInfo] = useState(null);
  const [coming, setComing] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [busRoutes, setBusRoutes] = useState({});
  const mapRef = useRef(null);
  const navigate = useNavigate();
  const googleMapRef = useRef(null);

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

    // Set current time for testing (5 PM to match your error log)
    setCurrentTime(new Date("2025-04-08T17:54:00"));
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const isVotingTime = () => {
    const hours = currentTime.getHours();
    return hours >= 16 && hours < 22; // 4 PM to 10 PM
  };

  const handleComingResponse = async (response) => {
    if (!isVotingTime()) {
      alert("You can only respond between 4 PM and 10 PM.");
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
    const loader = new Loader({
      apiKey: "AIzaSyC_Ydl8tvlX73YMmf0C6KfNDEmmN1LodMU",
      version: "weekly",
    });

    const initializeAndRenderMap = async () => {
      try {
        console.log("Loading Google Maps...");
        const google = await loader.load();
        if (!google || !google.maps) {
          throw new Error("Google Maps API failed to load");
        }
        const { maps } = google;

        if (!googleMapRef.current) {
          googleMapRef.current = new maps.Map(mapRef.current, {
            center: { lat: 5, lng: 5 },
            zoom: 8,
          });
          console.log("Map initialized:", googleMapRef.current);
        }

        const hours = currentTime.getHours();
        if (hours >= 17 && hours < 18 && googleMapRef.current) { // 5 PM to 6 PM
          console.log("Fetching bus routes at:", new Date().toISOString());
          const response = await fetch("http://localhost:5000/api/generate-routes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ timestamp: currentTime.toISOString() }),
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          console.log("Bus routes data received:", JSON.stringify(data.routes, null, 2));
          setBusRoutes(data.routes);

          Object.entries(data.routes).forEach(([busId, route]) => {
            if (route.length > 0) {
              const path = route.map((stop) => ({ lat: stop.lat, lng: stop.lng }));
              new maps.Polyline({
                path,
                geodesic: true,
                strokeColor: ["#FF0000", "#00FF00", "#0000FF"][busId % 3],
                strokeOpacity: 1.0,
                strokeWeight: 2,
                map: googleMapRef.current,
              });

              route.forEach((stop) => {
                const stopNumber = stop.name === "College" ? "C" : stop.name.split(" ")[1];
                new maps.Marker({
                  position: { lat: stop.lat, lng: stop.lng },
                  map: googleMapRef.current,
                  title: stop.name,
                  label: {
                    text: stop.students > 0 ? `${stopNumber} (${stop.students})` : stopNumber,
                    color: "black",
                    fontSize: "20px",
                    fontWeight: "bold",
                  },
                  icon: stop.name === "College" ? {
                    path: maps.SymbolPath.BACKWARD_CLOSED_ARROW, // Building-like symbol (square with point)
                    fillColor: "#0000FF", // Blue to distinguish from red stops
                    fillOpacity: 1,
                    strokeWeight: 1,
                    scale: 8,
                  } : {
                    path: maps.SymbolPath.CIRCLE,
                    fillColor: "#FF0000",
                    fillOpacity: 1,
                    strokeWeight: 0,
                    scale: 12,
                  },
                });
              });
            }
          });
        }
      } catch (error) {
        console.error("Error in map or routes:", error.message, error.stack);
      }
    };

    if (mapRef.current) {
      initializeAndRenderMap();
    }
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
            {!isVotingTime() && <p>Voting is only available between 4 PM and 10 PM.</p>}
          </div>

          <div>
            <h3>Bus Routes</h3>
            <div ref={mapRef} style={{ height: "400px", width: "100%" }} id="map" />
          </div>
        </div>
      ) : (
        <p>Loading...</p>
      )}
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
};

export default StudentDashboard;