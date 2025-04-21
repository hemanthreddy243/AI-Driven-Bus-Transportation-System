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
  const [currentPage, setCurrentPage] = useState(0);
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
        const lastVoteDate = data?.lastVoteDate || null;
        const today = new Date().toISOString().split("T")[0];
        if (lastVoteDate && lastVoteDate !== today) {
          set(ref(database, `users/${user.uid}/coming`), null);
          set(ref(database, `users/${user.uid}/lastVoteDate`), today);
          setComing(null);
        } else {
          setComing(data?.coming || null);
        }
      });
    }

    setCurrentTime(new Date("2025-04-12T17:54:00"));
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const isVotingTime = () => {
    const hours = currentTime.getHours();
    return hours >= 16 && hours < 22;
  };

  const handleComingResponse = async (response) => {
    if (!isVotingTime()) {
      alert("You can only respond between 4 PM and 10 PM.");
      return;
    }
    const user = auth.currentUser;
    if (user) {
      const today = new Date().toISOString().split("T")[0];
      await set(ref(database, `users/${user.uid}`), {
        ...studentInfo,
        coming: response,
        lastVoteDate: today,
      });
      setComing(response);
      alert(`You selected: ${response}`);
    }
  };

  useEffect(() => {
    const loader = new Loader({
      apiKey: "AIzaSyC_Ydl8tvlX73YMmf0C6KfNDEmmN1LodMU",
      version: "weekly",
    });

    const initializeMap = async () => {
      try {
        console.log("Loading Google Maps...");
        const google = await loader.load();
        if (!google || !google.maps) throw new Error("Google Maps API failed to load");
        const { maps } = google;

        if (mapRef.current && !googleMapRef.current) {
          googleMapRef.current = new maps.Map(mapRef.current, {
            center: { lat: 5, lng: 5 },
            zoom: 8,
          });
          console.log("Map initialized:", googleMapRef.current);
        }

        const hours = currentTime.getHours();
        if (hours >= 17 && hours < 18 && googleMapRef.current) {
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

          googleMapRef.current.controls[maps.ControlPosition.TOP_LEFT]?.clear();
          googleMapRef.current.data.forEach((feature) => googleMapRef.current.data.remove(feature));

          const routesArray = Object.entries(data.routes);
          if (routesArray.length > 0) {
            const [busId, route] = routesArray[currentPage];
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
                    color: "white",
                    fontSize: "12px",
                    fontWeight: "bold",
                  },
                  icon: stop.name === "College" ? {
                    path: maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                    fillColor: "#0000FF",
                    fillOpacity: 1,
                    strokeWeight: 1,
                    scale: 8,
                  } : {
                    path: maps.SymbolPath.CIRCLE,
                    fillColor: "#FF0000",
                    fillOpacity: 1,
                    strokeWeight: 0,
                    scale: 8,
                  },
                });
              });
            }
          }
        }
      } catch (error) {
        console.error("Error in map or routes:", error.message, error.stack);
      }
    };

    initializeMap();
  }, [currentTime, currentPage]);

  const handleLogout = async () => {
    await auth.signOut();
    navigate("/student-login");
  };

  const totalPages = Object.keys(busRoutes).length;

  return (
    <div style={styles.container}>
      <div style={styles.splitContainer}>
        <div className="detailsSection" style={styles.detailsSection}>
          <h2 style={styles.header}>Student Dashboard</h2>
          {studentInfo ? (
            <div style={styles.infoContent}>
              <div style={styles.infoBox}>
                <p style={styles.infoText}><strong>Name:</strong> {studentInfo.name}</p>
                <p style={styles.infoText}><strong>Student ID:</strong> {studentInfo.studentID}</p>
                <p style={styles.infoText}><strong>Stop ID:</strong> {studentInfo.stopID}</p>
              </div>

              <div style={styles.votingBox}>
                <h3 style={styles.subHeader}>Are you coming tomorrow?</h3>
                {coming === null ? (
                  <div style={styles.buttonGroup}>
                    <button style={styles.button} onClick={() => handleComingResponse("Yes")}>Yes</button>
                    <button style={styles.button} onClick={() => handleComingResponse("No")}>No</button>
                  </div>
                ) : (
                  <p style={styles.infoText}>You selected: {coming}</p>
                )}
                {!isVotingTime() && <p style={styles.warning}>Voting: 4 PM - 10 PM</p>}
              </div>

              <div style={styles.routesBox}>
                <h3 style={styles.subHeader}>Bus Routes</h3>
                {totalPages > 0 ? (
                  <>
                    <div style={styles.routeInfo}>
                      <h4 style={styles.routeTitle}>Bus {Object.keys(busRoutes)[currentPage]}</h4>
                      <ul style={styles.routeList}>
                        {busRoutes[Object.keys(busRoutes)[currentPage]].map((stop, index) => (
                          <li key={index} style={styles.routeItem}>
                            {stop.name} - Students: {stop.students}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div style={styles.pagination}>
                      <button
                        style={styles.pageButton}
                        onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 0))}
                        disabled={currentPage === 0}
                      >
                        Previous
                      </button>
                      <span style={styles.pageInfo}>
                        Page {currentPage + 1} of {totalPages}
                      </span>
                      <button
                        style={styles.pageButton}
                        onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages - 1))}
                        disabled={currentPage === totalPages - 1}
                      >
                        Next
                      </button>
                    </div>
                  </>
                ) : (
                  <p style={styles.infoText}>No routes yet. Check 5 PM - 6 PM.</p>
                )}
              </div>
            </div>
          ) : (
            <p style={styles.loading}>Loading...</p>
          )}
          <button className="logoutButton" style={styles.logoutButton} onClick={handleLogout}>Logout</button>
        </div>

        <div className="mapSection" style={styles.mapSection}>
          <div ref={mapRef} style={styles.map}></div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: "100vh",
    padding: "20px",
    backgroundImage: "url('https://images.unsplash.com/photo-1503984107770-9c18f4323f34?q=80&w=2070&auto=format&fit=crop')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    fontFamily: "'Arial', sans-serif",
  },
  splitContainer: {
    display: "flex",
    flexDirection: "row",
    height: "calc(100vh - 40px)",
    overflow: "hidden",
    borderRadius: "10px",
    boxShadow: "0 4px 15px rgba(0, 0, 0, 0.2)",
    animation: "fadeIn 0.5s ease-in-out",
  },
  detailsSection: {
    width: "40%",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    padding: "20px",
    overflowY: "auto",
    transition: "transform 0.3s ease-in-out",
    transform: "translateX(0)",
  },
  mapSection: {
    width: "60%",
    backgroundColor: "#fff",
    padding: "10px",
    transition: "transform 0.3s ease-in-out",
    transform: "translateX(0)",
    display: "flex", // Ensure map fills the section
  },
  map: {
    height: "100%",
    width: "100%",
    borderRadius: "8px",
    border: "1px solid #ddd",
  },
  header: {
    fontSize: "26px",
    color: "#2c3e50",
    textAlign: "center",
    marginBottom: "20px",
  },
  infoContent: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  infoBox: {
    padding: "15px",
    borderRadius: "8px",
    backgroundColor: "#ecf0f1",
  },
  infoText: {
    fontSize: "15px",
    color: "#34495e",
    margin: "8px 0",
  },
  votingBox: {
    padding: "15px",
    borderRadius: "8px",
    backgroundColor: "#ecf0f1",
  },
  subHeader: {
    fontSize: "18px",
    color: "#2c3e50",
    marginBottom: "10px",
  },
  buttonGroup: {
    display: "flex",
    gap: "10px",
  },
  button: {
    padding: "8px 16px",
    fontSize: "14px",
    color: "#fff",
    backgroundColor: "#3498db",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    transition: "background-color 0.3s, transform 0.2s",
  },
  warning: {
    color: "#e74c3c",
    fontSize: "13px",
    marginTop: "8px",
  },
  routesBox: {
    padding: "15px",
    borderRadius: "8px",
    backgroundColor: "#ecf0f1",
  },
  routeInfo: {
    marginBottom: "15px",
  },
  routeTitle: {
    fontSize: "16px",
    color: "#2c3e50",
    marginBottom: "8px",
  },
  routeList: {
    listStyleType: "none",
    padding: 0,
  },
  routeItem: {
    fontSize: "13px",
    color: "#34495e",
    padding: "5px 0",
    borderBottom: "1px solid #dfe6e9",
  },
  pagination: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "12px",
    marginTop: "15px",
  },
  pageButton: {
    padding: "6px 12px",
    fontSize: "13px",
    color: "#fff",
    backgroundColor: "#3498db",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    transition: "background-color 0.3s, transform 0.2s",
    opacity: (props) => (props.disabled ? "0.5" : "1"),
  },
  pageInfo: {
    fontSize: "13px",
    color: "#2c3e50",
  },
  loading: {
    fontSize: "15px",
    color: "#34495e",
    textAlign: "center",
    marginTop: "20px",
  },
  logoutButton: {
    display: "block",
    margin: "20px auto 0",
    padding: "10px 20px",
    fontSize: "14px",
    color: "#fff",
    backgroundColor: "#e74c3c",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    transition: "background-color 0.3s, transform 0.2s",
  },
};

export default StudentDashboard;