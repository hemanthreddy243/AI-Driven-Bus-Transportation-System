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

  // Fetch student info and handle voting timer
  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      const studentRef = ref(database, `users/${user.uid}`);
      const unsubscribe = onValue(studentRef, (snapshot) => {
        const data = snapshot.val();
        setStudentInfo(data);
        console.log("Student Info:", data);
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

    setCurrentTime(new Date());
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const isVotingTime = () => {
    const hours = currentTime.getUTCHours();
    const minutes = currentTime.getUTCMinutes();
    const canVote = true; //(hours >= 11 && hours < 20) || (hours === 3 && minutes >= 30) || (hours === 4 && minutes <= 0);
    console.log(
      "Voting Time Check - Current Time (UTC):",
      currentTime.toISOString(),
      "Hours (UTC):",
      hours,
      "Minutes:",
      minutes,
      "Can Vote:",
      canVote
    );
    return canVote;
  };

  const handleComingResponse = async (response) => {
    if (!isVotingTime()) {
      alert("You can only respond between 11 AM and 8 PM or during the test window (9:00 AM to 9:30 AM IST).");
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

  // Fetch bus routes and initialize map
  useEffect(() => {
    const loader = new Loader({
      apiKey: "AIzaSyC_Ydl8tvlX73YMmf0C6KfNDEmmN1LodMU",
      version: "weekly",
    });

    const initializeMapAndFetchRoutes = async () => {
      if (hasFetched.current) return;
      hasFetched.current = true;

      try {
        console.log("Loading Google Maps...");
        const google = await loader.load();
        if (!google || !google.maps) throw new Error("Google Maps API failed to load");
        const { maps } = google;

        if (mapRef.current && !googleMapRef.current) {
          googleMapRef.current = new maps.Map(mapRef.current, {
            center: { lat: 17.1667, lng: 78.8333 }, // Center on Vignan Institute in Deshmukhi
            zoom: 10,
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
      } catch (error) {
        console.error("Error in map or routes:", error.message, error.stack);
        alert("Failed to load routes: " + error.message);
      }
    };

    initializeMapAndFetchRoutes();
  }, []);

  // Plot all routes on the map
  useEffect(() => {
    if (!googleMapRef.current || !busRoutes) return;

    const { maps } = window.google;

    // Clear previous polylines and markers
    googleMapRef.current.controls[maps.ControlPosition.TOP_LEFT]?.clear();
    googleMapRef.current.data.forEach((feature) => googleMapRef.current.data.remove(feature));
    if (googleMapRef.current.polylines) {
      googleMapRef.current.polylines.forEach((polyline) => polyline.setMap(null));
    }
    if (googleMapRef.current.markers) {
      googleMapRef.current.markers.forEach((marker) => marker.setMap(null));
    }
    googleMapRef.current.polylines = [];
    googleMapRef.current.markers = [];

    // Filter routes based on "Show My Route Only"
    const routesArray = Object.entries(busRoutes);
    console.log("Routes Array:", routesArray);
    const displayRoutes = showMyRouteOnly && studentInfo?.stopID
      ? routesArray.filter(([_, route]) =>
          route.stops.some((item) => item.stop.name === `Stop ${studentInfo.stopID}` || item.stop.name === studentInfo.stopID))
      : routesArray;
    console.log("Display Routes:", displayRoutes);

    if (displayRoutes.length === 0) {
      console.log("No routes to display after filtering.");
      return;
    }

    // Plot all displayRoutes on the map
    displayRoutes.forEach(([busId, route]) => {
      console.log("Plotting Route for Bus", busId, ":", route);

      if (!route || !route.stops || route.stops.length === 0) {
        console.log("Route is empty for Bus", busId);
        return;
      }

      const path = route.stops.map((item) => ({ lat: item.stop.lat, lng: item.stop.lng }));
      console.log("Polyline Path for Bus", busId, ":", path);

      const polyline = new maps.Polyline({
        path,
        geodesic: true,
        strokeColor: route.color,
        strokeOpacity: 1.0,
        strokeWeight: 2,
        map: googleMapRef.current,
      });
      googleMapRef.current.polylines.push(polyline);

      route.stops.forEach((item) => {
        console.log(`Plotting stop: ${item.stop.name} at lat: ${item.stop.lat}, lng: ${item.stop.lng}`);
        const stop = item.stop;
        const eta = item.eta;
        const labelText = stop.name === "College" ? "C" : stop.name === studentInfo?.stopID ? `S${studentInfo.stopID}` : stop.name.charAt(0);
        const marker = new maps.Marker({
          position: { lat: stop.lat, lng: stop.lng },
          map: googleMapRef.current,
          title: `${stop.name} (ETA: ${eta}, Bus ${busId})`,
          label: {
            text: stop.students > 0 ? `${labelText} (${stop.students})` : labelText,
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
            fillColor: route.color,
            fillOpacity: 1,
            strokeWeight: 0,
            scale: 8,
          },
        });
        googleMapRef.current.markers.push(marker);
      });
    });

    // Add a legend to the map using DOM manipulation
    const legendDiv = document.createElement("div");
    legendDiv.style.backgroundColor = "rgba(255, 255, 255, 0.9)";
    legendDiv.style.padding = "10px";
    legendDiv.style.borderRadius = "5px";
    legendDiv.style.boxShadow = "0 2px 5px rgba(0,0,0,0.2)";
    legendDiv.style.fontSize = "12px";

    const legendTitle = document.createElement("h4");
    legendTitle.textContent = "Bus Legend";
    legendDiv.appendChild(legendTitle);

    displayRoutes.forEach(([busId, route]) => {
      const legendItem = document.createElement("div");
      legendItem.style.display = "flex";
      legendItem.style.alignItems = "center";
      legendItem.style.margin = "5px 0";

      const colorBox = document.createElement("div");
      colorBox.style.width = "20px";
      colorBox.style.height = "10px";
      colorBox.style.backgroundColor = route.color;
      colorBox.style.marginRight = "5px";

      const busLabel = document.createElement("span");
      busLabel.textContent = `Bus ${busId}`;

      legendItem.appendChild(colorBox);
      legendItem.appendChild(busLabel);
      legendDiv.appendChild(legendItem);
    });

    googleMapRef.current.controls[maps.ControlPosition.TOP_LEFT].push(legendDiv);
  }, [busRoutes, showMyRouteOnly, studentInfo]);

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
        route.stops.some((item) => item.stop.name === `Stop ${studentInfo.stopID}` || item.stop.name === studentInfo.stopID)).length
    : Object.keys(busRoutes).length;

  const displayRoutes = showMyRouteOnly && studentInfo?.stopID
    ? Object.entries(busRoutes).filter(([_, route]) =>
        route.stops.some((item) => item.stop.name === `Stop ${studentInfo.stopID}` || item.stop.name === studentInfo.stopID))
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
                {!isVotingTime() && (
                  <p style={styles.warning}>
                    Voting: 11 AM - 8 PM UTC (4:30 PM - 1:30 AM IST) or 9:00 AM - 9:30 AM IST (Test)
                  </p>
                )}
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
                        {displayRoutes[currentPage][1].stops.map((item, index) => (
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