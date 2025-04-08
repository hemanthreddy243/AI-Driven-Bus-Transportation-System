import traceback
from flask import Flask, request, jsonify
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, db
import networkx as nx
import numpy as np
from sklearn.cluster import KMeans

app = Flask(__name__)
CORS(app)

# Initialize Firebase
cred = credentials.Certificate("firebase-adminsdk.json")
firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://test-47797-default-rtdb.asia-southeast1.firebasedatabase.app/'
})

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

    num_buses = 3
    coordinates = np.array([[x, y] for x, y, _ in bus_stops.values()])
    if len(coordinates) == 0:
        print("Warning: No coordinates for KMeans.")
        return {}
    kmeans = KMeans(n_clusters=num_buses, random_state=42, n_init=10).fit(coordinates)
    clusters = kmeans.labels_
    # Convert numpy.int32 to int for cluster_mapping keys
    cluster_mapping = {list(bus_stops.keys())[i]: int(clusters[i]) for i in range(len(clusters))}

    routes = assign_routes(G, cluster_mapping, college_location)
    
    route_data = {}
    for bus_id, route in routes.items():
        route_data[bus_id] = [
            {"name": stop if stop == "College" else f"Stop {stop}", 
             "lat": G.nodes[stop]['pos'][1], 
             "lng": G.nodes[stop]['pos'][0], 
             "students": G.nodes[stop]['students'] if stop != "College" else 0}
            for stop in route
        ]
    return route_data

def assign_routes(G, cluster_mapping, end_location):
    routes = {}
    # Convert numpy.int32 to int for bus_id
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
        routes[bus_id] = route
    return routes

@app.route('/api/generate-routes', methods=['POST'])
def generate_routes_endpoint():
    print("Received POST request for /api/generate-routes")
    try:
        data = request.get_json()
        print("Received data:", data)
        if not data or 'timestamp' not in data:
            return jsonify({"error": "Invalid request data"}), 400
        print("Received timestamp:", data.get("timestamp"))
        ref_users = db.reference('users')
        users = ref_users.get()
        print("Fetched users:", users)
        if not users:
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