import traceback
from flask import Flask, request, jsonify
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, db
import googlemaps
from datetime import datetime, timedelta
import networkx as nx
import numpy as np
from sklearn.cluster import KMeans

app = Flask(__name__)
CORS(app)

cred = credentials.Certificate("firebase-adminsdk.json")
firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://test-47797-default-rtdb.asia-southeast1.firebasedatabase.app/'
})

gmaps = googlemaps.Client(key="AIzaSyC_Ydl8tvlX73YMmf0C6KfNDEmmN1LodMU")
BUS_CAPACITY = 50

def generate_routes(student_counts):
    if not student_counts:
        print("Warning: No students with coming: 'Yes' found.")
        return {}

    bus_stops = {
        0: (4.0060, 9.7600, student_counts.get("0", 0)),
        1: (4.0800, 9.7500, student_counts.get("1", 0)),
        2: (4.0500, 9.7000, student_counts.get("2", 0)),
        3: (4.0000, 9.7200, student_counts.get("3", 0)),
        4: (4.0300, 9.7800, student_counts.get("4", 0)),
        5: (4.1000, 9.6800, student_counts.get("5", 0)),
    }
    college_location = (4.0511, 9.7679)

    G = nx.Graph()
    for stop, (x, y, students) in bus_stops.items():
        G.add_node(stop, pos=(x, y), students=students)
    G.add_node("College", pos=college_location)

    active_stops = {stop: data for stop, data in bus_stops.items() if data[2] > 0}
    if not active_stops:
        print("Warning: No active stops with students.")
        return {"0": [{"name": "College", "lat": college_location[1], "lng": college_location[0], "students": 0}]}

    total_students = sum(data[2] for data in active_stops.values())
    min_buses = max(1, (total_students + BUS_CAPACITY - 1) // BUS_CAPACITY)
    print(f"Total students: {total_students}, Minimum buses required: {min_buses}")

    coordinates = np.array([[x, y] for x, y, _ in active_stops.values()])
    stop_ids = list(active_stops.keys())
    students_per_stop = [active_stops[stop][2] for stop in stop_ids]

    if len(active_stops) <= min_buses:
        cluster_mapping = {stop: i for i, stop in enumerate(stop_ids)}
        cluster_student_counts = {i: active_stops[stop][2] for i, stop in enumerate(stop_ids)}
    else:
        kmeans = KMeans(n_clusters=min_buses, random_state=42, n_init=10).fit(coordinates)
        clusters = kmeans.labels_
        cluster_mapping = {stop_ids[i]: int(clusters[i]) for i in range(len(stop_ids))}

        cluster_student_counts = {i: 0 for i in range(min_buses)}
        for stop, cluster in cluster_mapping.items():
            cluster_student_counts[cluster] += active_stops[stop][2]

        while max(cluster_student_counts.values()) > BUS_CAPACITY:
            overfilled_cluster = max(cluster_student_counts, key=cluster_student_counts.get)
            overfilled_stops = [stop for stop, c in cluster_mapping.items() if c == overfilled_cluster]
            stop_to_move = overfilled_stops[0]
            new_cluster = min_buses
            cluster_mapping[stop_to_move] = new_cluster
            cluster_student_counts[new_cluster] = active_stops[stop_to_move][2]
            cluster_student_counts[overfilled_cluster] -= active_stops[stop_to_move][2]
            min_buses += 1

    print(f"Final number of buses: {min_buses}")
    print(f"Cluster student counts: {cluster_student_counts}")

    routes = assign_routes(G, cluster_mapping, college_location)
    route_data = {}
    for bus_id, route in routes.items():
        route_with_times = calculate_arrival_times(route, G)
        route_data[str(bus_id)] = [
            {"stop": {
                "name": stop if stop == "College" else f"Stop {stop}", 
                "lat": G.nodes[stop]['pos'][1], 
                "lng": G.nodes[stop]['pos'][0], 
                "students": G.nodes[stop]['students'] if stop != "College" else 0
             }, "eta": eta}
            for stop, eta in route_with_times
        ]
    return route_data

def assign_routes(G, cluster_mapping, end_location):
    routes = {}
    for bus_id in set(int(x) for x in cluster_mapping.values()):
        bus_stops = [stop for stop, c in cluster_mapping.items() if int(c) == bus_id]
        bus_stops.append("College")
        if len(bus_stops) == 1:
            routes[bus_id] = bus_stops
            continue
        
        subgraph = nx.Graph()
        for u in bus_stops:
            for v in bus_stops:
                if u != v and u in G.nodes and v in G.nodes:
                    pos_u = np.array(G.nodes[u]['pos'])
                    pos_v = np.array(G.nodes[v]['pos'])
                    distance = np.linalg.norm(pos_u - pos_v)
                    subgraph.add_edge(u, v, weight=distance)
        
        if len(subgraph.edges) == 0:
            routes[bus_id] = bus_stops
            continue
        
        route = list(nx.approximation.traveling_salesman_problem(subgraph, cycle=False))
        if route[-1] != "College":
            route.append("College")
        routes[bus_id] = route
    return routes

def calculate_arrival_times(route, G, start_time="17:30:00"):
    times = []
    current_time = datetime.strptime(f"2025-04-12 {start_time}", "%Y-%m-%d %H:%M:%S")
    
    for i in range(len(route)):
        stop = route[i]
        if i == 0:
            times.append((stop, current_time.strftime("%H:%M")))
            continue
        
        origin = G.nodes[route[i-1]]['pos']
        destination = G.nodes[stop]['pos']
        try:
            directions_result = gmaps.directions(
                (origin[1], origin[0]),
                (destination[1], destination[0]),
                mode="driving",
                departure_time="now"
            )
            if directions_result:
                leg = directions_result[0]["legs"][0]
                travel_time_seconds = leg["duration_in_traffic"]["value"]
                current_time += timedelta(seconds=travel_time_seconds)
                times.append((stop, current_time.strftime("%H:%M")))
            else:
                raise Exception("No directions found")
        except Exception as e:
            print(f"Traffic API failed for {route[i-1]} to {stop}: {e}. Using fallback.")
            from math import radians, sin, cos, sqrt, atan2
            R = 6371
            lat1, lon1 = radians(origin[1]), radians(origin[0])
            lat2, lon2 = radians(destination[1]), radians(destination[0])
            dlat, dlon = lat2 - lat1, lon2 - lon1
            a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
            c = 2 * atan2(sqrt(a), sqrt(1-a))
            distance = R * c
            travel_time_minutes = (distance / 40) * 60
            current_time += timedelta(minutes=travel_time_minutes)
            times.append((stop, current_time.strftime("%H:%M")))
    
    return times

@app.route('/api/generate-routes', methods=['POST'])
def generate_routes_endpoint():
    print("Received POST request for /api/generate-routes")
    try:
        data = request.get_json()
        print("Received data:", data)
        if not data or 'timestamp' not in data:
            print("Invalid request data received")
            return jsonify({"error": "Invalid request data"}), 400
        
        timestamp = data.get("timestamp")
        print("Received timestamp:", timestamp)
        request_time = datetime.strptime(timestamp, "%Y-%m-%dT%H:%M:%S.%fZ")
        if not (17 <= request_time.hour < 18):
            print("Request outside 5-6 PM window:", request_time)
            return jsonify({"error": "Routes only generated between 5 PM and 6 PM"}), 400

        ref_users = db.reference('users')
        users = ref_users.get()
        print("Fetched users:", users)
        if not users:
            print("No user data available in Firebase")
            return jsonify({"error": "No user data available"}), 400

        student_counts = {}
        for uid, user in users.items():
            if user.get('coming') == 'Yes':
                stop_id = str(user.get('stopID'))
                student_counts[stop_id] = student_counts.get(stop_id, 0) + 1
        print("Student counts:", student_counts)

        routes = generate_routes(student_counts)
        print("Generated routes:", routes)
        return jsonify({"routes": routes})
    except Exception as e:
        print("Exception occurred:", str(e), "Traceback:", traceback.format_exc())
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("Registered routes:", list(app.url_map.iter_rules()))
    app.run(host='0.0.0.0', port=5000)