import React, { useState, useEffect } from "react";
import { auth, database } from "../firebase";
import { ref, onValue, remove } from "firebase/database";
import { useNavigate } from "react-router-dom";

const AdminPanel = () => {
  const [students, setStudents] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const studentsRef = ref(database, "students");
    onValue(studentsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setStudents(Object.entries(data).map(([id, student]) => ({ id, ...student })));
      }
    });
  }, []);

  const handleDelete = async (studentId) => {
    await remove(ref(database, `students/${studentId}`));
  };

  const handleLogout = async () => {
    await auth.signOut();
    navigate("/admin-login");
  };

  return (
    <div>
      <h2>Admin Panel</h2>
      <button onClick={handleLogout}>Logout</button>
      <h3>Registered Students</h3>
      <ul>
        {students.map((student) => (
          <li key={student.id}>
            {student.name} - {student.studentId} - Stop {student.stopNumber}
            <button onClick={() => handleDelete(student.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AdminPanel;
