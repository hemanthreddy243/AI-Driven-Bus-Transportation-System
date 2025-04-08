import React, { useState, useEffect, useRef } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { auth, database } from "../firebase";
import { ref, onValue, set } from "firebase/database";
import { useNavigate } from "react-router-dom";

const StudentDashboard = () => {
  const [studentInfo, setStudentInfo] = useState(null);
  const [coming, setComing] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [busRoutes, setBusRoutes] = useState(null);
  const mapRef = useRef(null);
  const navigate = useNavigate();
  const googleMapRef = useRef(null); // Store the map instance

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

    // Set current time for testing (remove after testing)
    setCurrentTime(new Date("2025-04-08T22:00:00")); // 10 PM for map

    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const isVotingTime = () => {
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
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

  // Initialize map when the container is available
  useEffect(() => {
    if (!mapRef.current) return; // Exit if container not found

    const loader = new Loader({
      apiKey: "AIzaSyC_Ydl8tvlX73YMmf0C6KfNDEmmN1LodMU",
      version: "weekly",
    });

    const initializeMap = async () => {
      try {
        console.log("Initializing Google Maps...");
        const google = await loader.load();
        console.log("Google Maps loaded:", google);
        if (!google || !google.maps) {
          throw new Error("Google Maps API failed to load");
        }
        const { maps } = google;
        googleMapRef.current = new maps.Map(mapRef.current, {
          center: { lat: 5, lng: 5 },
          zoom: 8,
        });
        console.log("Map initialized:", googleMapRef.current);
      } catch (error) {
        console.error("Error initializing map:", error.message, error.stack);
      }
    };

    initializeMap();
  }, [mapRef]); // Depend on mapRef to trigger when the ref is set

  // Fetch and render routes
  useEffect(() => {
    const fetchAndRenderRoutes = async () => {
      const hours = currentTime.getHours();
      if (hours >= 22 && googleMapRef.current) { // Render routes after 10 PM if map exists
        try {
          console.log("Fetching bus routes from backend at:", new Date().toISOString());
          const response = await fetch("http://localhost:5000/api/generate-routes", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ timestamp: currentTime.toISOString() }),
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          console.log("Bus routes data received:", JSON.stringify(data.routes, null, 2));
          setBusRoutes(data.routes);

          const { maps } = await new Loader({
            apiKey: "AIzaSyC_Ydl8tvlX73YMmf0C6KfNDEmmN1LodMU",
            version: "weekly",
          }).load(); // Re-load maps namespace for consistency

          // Clear existing overlays
          googleMapRef.current.data.forEach((feature) => {
            googleMapRef.current.data.remove(feature);
          });

          Object.entries(data.routes).forEach(([busId, route]) => {
            if (route.length > 0) {
              const path = route.map((stop) => ({
                lat: stop.lat,
                lng: stop.lng,
              }));

              new maps.Polyline({
                path,
                geodesic: true,
                strokeColor: ["#FF0000", "#00FF00", "#0000FF"][busId % 3],
                strokeOpacity: 1.0,
                strokeWeight: 2,
                map: googleMapRef.current,
              });

              route.forEach((stop) => {
                new maps.Marker({
                  position: { lat: stop.lat, lng: stop.lng },
                  map: googleMapRef.current,
                  title: stop.name,
                  label: stop.students ? `${stop.students}` : null,
                  icon: stop.name === "College" ? {
                    path: maps.SymbolPath.CIRCLE,
                    fillColor: "#FF0000", // Red circle for college
                    fillOpacity: 1,
                    strokeWeight: 0,
                    scale: 10,
                  } : null, // Default icon for other stops
                });
              });
            }
          });
        } catch (error) {
          console.error("Error fetching bus routes or rendering map:", error.message, error.stack);
        }
      }
    };

    fetchAndRenderRoutes();
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

          {/* Render map container unconditionally */}
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