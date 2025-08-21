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
  const [showMyRouteOnly, setShowMyRouteOnly] = useState(false);
  const mapRef = useRef(null);
  const navigate = useNavigate();
  const googleMapRef = useRef(null);
  const hasFetched = useRef(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      const studentRef = ref(database, `users/${user.uid}`);
      const unsubscribe = onValue(studentRef, (snapshot) => {
        const data = snapshot.val();
        console.log("Fetched student data:", data);
        setStudentInfo(data);
        const lastVoteDate = data?.lastVoteDate || null;
        const today = new Date().toISOString().split("T")[0];
        if (!lastVoteDate || lastVoteDate !== today) {
          set(ref(database, `users/${user.uid}/coming`), null);
          set(ref(database, `users/${user.uid}/lastVoteDate`), today);
          setComing(null);
        } else {
          setComing(data?.coming || null);
        }
      });
      return () => unsubscribe();
    } else {
      console.log("No user logged in");
    }

    const testTime = new Date("2025-04-24T18:00:00-07:00"); // 6 PM PDT for testing
    console.log("Setting initial currentTime:", testTime.toISOString(), "Local:", testTime.toLocaleString());
    setCurrentTime(testTime);
  }, []);

  const isVotingTime = () => {
    const hours = currentTime.getHours();
    console.log("isVotingTime - hours:", hours, "result:", hours >= 16 && hours < 22);
    return hours >= 16 && hours < 22; // 4 PM to 10 PM
  };

  const handleComingResponse = async (response) => {
    console.log("Attempting to vote, isVotingTime:", isVotingTime(), "currentTime:", currentTime.toISOString());
    if (!isVotingTime()) {
      alert("You can only respond between 4 PM and 10 PM.");
      return;
    }
    const user = auth.currentUser;
    if (user) {
      console.log("User logged in, UID:", user.uid, "studentInfo:", studentInfo);
      const today = new Date().toISOString().split("T")[0];
      try {
        await set(ref(database, `users/${user.uid}`), {
          ...studentInfo,
          coming: response,
          lastVoteDate: today,
        });
        setComing(response);
        alert(`You selected: ${response}`);
        console.log("Vote saved successfully, coming:", response);
      } catch (error) {
        console.error("Error saving vote:", error.message, error.stack);
        alert("Failed to save your vote: " + error.message);
      }
    } else {
      console.log("No user logged in during vote attempt");
      alert("Please log in to vote.");
    }
  };

  useEffect(() => {
    const loader = new Loader({
      apiKey: "AIzaSyC_Ydl8tvlX73YMmf0C6KfNDEmmN1LodMU",
      version: "weekly",
      libraries: ["directions"],
    });

    const initializeMap = async () => {
      if (hasFetched.current) return;
      hasFetched.current = true;

      try {
        console.log("Loading Google Maps...");
        const google = await loader.load();
        if (!google || !google.maps) throw new Error("Google Maps API failed to load");
        const { maps } = google;

        if (mapRef.current && !googleMapRef.current) {
          googleMapRef.current = new maps.Map(mapRef.current, {
            center: { lat: 9.7679, lng: 4.0511 },
            zoom: 12,
          });
          console.log("Map initialized:", googleMapRef.current);
        }

        console.log("Fetching bus routes at:", currentTime.toISOString());
        const response = await fetch("http://localhost:5000/api/generate-routes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timestamp: currentTime.toISOString() }),
        });
        if (!response.ok) {
          const errorText = await response.text();
          console.error("Fetch error:", response.status, errorText);
          throw new Error(`Server error: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        console.log("Bus routes data received:", JSON.stringify(data.routes, null, 2));
        setBusRoutes(data.routes);

        const routesArray = Object.entries(data.routes);
        const displayRoutes = showMyRouteOnly && studentInfo?.stopID
          ? routesArray.filter(([_, route]) =>
              route.some((item) => item.stop.name === `Stop ${studentInfo.stopID}`))
          : routesArray;

        googleMapRef.current.controls[maps.ControlPosition.TOP_LEFT]?.clear();
        googleMapRef.current.data.forEach((feature) => googleMapRef.current.data.remove(feature));

        if (displayRoutes.length > 0) {
          const [busId, route] = displayRoutes[currentPage];
          if (route.length > 0) {
            const path = route.map((item) => ({ lat: item.stop.lat, lng: item.stop.lng }));
            new maps.Polyline({
              path,
              geodesic: true,
              strokeColor: ["#FF0000", "#00FF00", "#0000FF"][busId % 3],
              strokeOpacity: 1.0,
              strokeWeight: 2,
              map: googleMapRef.current,
            });

            route.forEach((item) => {
              const stop = item.stop;
              const eta = item.eta;
              const stopNumber = stop.name === "College" ? "C" : stop.name.split(" ")[1];
              new maps.Marker({
                position: { lat: stop.lat, lng: stop.lng },
                map: googleMapRef.current,
                title: `${stop.name} (ETA: ${eta})`,
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
      } catch (error) {
        console.error("Error in map or routes:", error.message, error.stack);
        alert("Failed to load routes: " + error.message);
      }
    };

    initializeMap();
  }, [showMyRouteOnly, studentInfo, currentTime]);

  const handleToggleRouteView = () => {
    setShowMyRouteOnly((prev) => !prev);
    setCurrentPage(0);
  };

  const handleLogout = async () => {
    await auth.signOut();
    navigate("/student-login");
  };

  const totalPages = showMyRouteOnly && studentInfo?.stopID
    ? Object.entries(busRoutes).filter(([_, route]) =>
        route.some((item) => item.stop.name === `Stop ${studentInfo.stopID}`)).length
    : Object.keys(busRoutes).length;

  const displayRoutes = showMyRouteOnly && studentInfo?.stopID
    ? Object.entries(busRoutes).filter(([_, route]) =>
        route.some((item) => item.stop.name === `Stop ${studentInfo.stopID}`))
    : Object.entries(busRoutes);

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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={styles.subHeader}>Bus Routes</h3>
                  {studentInfo?.stopID && (
                    <button style={styles.toggleButton} onClick={handleToggleRouteView}>
                      {showMyRouteOnly ? "Show All Routes" : "Show My Route Only"}
                    </button>
                  )}
                </div>
                {totalPages > 0 ? (
                  <>
                    <div style={styles.routeInfo}>
                      <h4 style={styles.routeTitle}>Bus {displayRoutes[currentPage][0]}</h4>
                      <ul style={styles.routeList}>
                        {displayRoutes[currentPage][1].map((item, index) => (
                          <li key={index} style={styles.routeItem}>
                            {item.stop.name} - Students: {item.stop.students}, ETA: {item.eta}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {!showMyRouteOnly && totalPages > 1 && (
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
                    )}
                  </>
                ) : (
                  <p style={styles.infoText}>
                    {showMyRouteOnly ? "No route found for your stop." : "No routes yet."}
                  </p>
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
    display: "flex",
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
  toggleButton: {
    padding: "6px 12px",
    fontSize: "13px",
    color: "#fff",
    backgroundColor: "#2ecc71",
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
    padding: "0",
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