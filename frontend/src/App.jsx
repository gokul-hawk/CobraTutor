
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import authService from './services/authService';
import Login from './components/Login';
import Register from './components/Register';
import Playground from './components/Playground';
import Quiz from './components/Quiz';
import PythonRunner from './components/Coding';
import Dashboard from './components/Dashboard';
import TutorApp from './components/Chat/TutorApp';
// A wrapper component to protect routes
const PrivateRoute = ({ children }) => {
    const user = authService.getCurrentUser();
    return user ? children : <Navigate to="/login" />;
};

function App() {
    
    return ( <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/Playground" element={<Playground />} />
        <Route path="/coding" element={<PythonRunner />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
       <Route path='/quiz' element={<Quiz />} />
       <Route path='/coding' element={<PythonRunner />} />
        <Route path='/tutor' element={<TutorApp />} />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>);

}

export default App;