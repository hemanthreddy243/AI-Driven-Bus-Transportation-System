from flask import Flask, request, jsonify
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, db
import networkx as nx
import numpy as np
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans
from io import BytesIO
import base64

app = Flask(__name__)
CORS(app)  # Enable CORS

# Initialize Firebase
cred = credentials.Certificate("backend/firebase-adminsdk.json")
firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://test-47797-default-rtdb.asia-southeast1.firebasedatabase.app/'
})

def generate_routes(student_counts):
    bus_stops = {
        0: (1, 2, student_counts.get("0", 0)),
        1: (2, 3, student_counts.get("1", 0)),
        2: (5, 1, student_counts.get("2", 0)),
        3: (6, 4, student_counts.get("3", 0)),
        4: (8, 3, student_counts.get("4", 0)),
        5: (9, 6, student_counts.get("5", 0)),
    }
    college_location = (5, 5)

    G = nx.Graph()
    positions = {}
    for stop, (x, y, students) in bus_stops.items():
        G.add_node(stop, pos=(x, y), students=students)
        positions[stop] = (x, y)
    G.add_node("College", pos=college_location)
    positions["College"] = college_location

    num_buses = 3
    coordinates = np.array([[x, y] for x, y, _ in bus_stops.values()])
    kmeans = KMeans(n_clusters=num_buses, random_state=42, n_init=10).fit(coordinates)
    clusters = kmeans.labels_
    cluster_mapping = {list(bus_stops.keys())[i]: clusters[i] for i in range(len(clusters))}

    routes = assign_routes(G, cluster_mapping, college_location)
    return plot_routes_to_image(G, routes, college_location)

def assign_routes(G, cluster_mapping, end_location):
    routes = {}
    for bus_id in set(cluster_mapping.values()):
        bus_stops = [stop for stop, c in cluster_mapping.items() if c == bus_id]
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

def plot_routes_to_image(G, routes, end_location):
    pos = {node: G.nodes[node]['pos'] for node in G.nodes}
    plt.figure(figsize=(8, 6))
    nx.draw(G, pos, with_labels=True, node_color='gray', node_size=700, edge_color='lightgray')
    plt.scatter(*end_location, c='black', marker='s', s=200, label="College")
    colors = ['red', 'blue', 'green', 'orange', 'purple', 'brown']
    for i, (bus_id, route) in enumerate(routes.items()):
        if len(route) > 1:
            path_edges = [(route[j], route[j+1]) for j in range(len(route)-1)]
            nx.draw_networkx_edges(G, pos, edgelist=path_edges, edge_color=colors[i % len(colors)], width=2)
            for stop in route:
                if stop != "College":
                    x, y = G.nodes[stop]['pos']
                    students = G.nodes[stop]['students']
                    plt.text(x, y+0.2, str(students), fontsize=10, color='black', ha='center')
    plt.title("Bus Routes Visualization")
    plt.legend()

    img_io = BytesIO()
    plt.savefig(img_io, format='png', bbox_inches='tight')
    img_io.seek(0)
    img_base64 = base64.b64encode(img_io.getvalue()).decode('utf-8')
    plt.close()
    return f"data:image/png;base64,{img_base64}"

@app.route('/api/generate-routes', methods=['POST'])
def generate_routes_endpoint():
    try:
        data = request.get_json()
        print("Received timestamp:", data.get("timestamp"))
        ref_users = db.reference('users')
        users = ref_users.get()
        if not users:
            return jsonify({"error": "No user data available"}), 400

        student_counts = {}
        for uid, user in users.items():
            if user.get('coming') == 'Yes':
                stop_id = str(user.get('stopID'))
                student_counts[stop_id] = student_counts.get(stop_id, 0) + 1

        image_url = generate_routes(student_counts)
        return jsonify({"imageUrl": image_url})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)