import React from 'react';
import { Link } from 'react-router-dom';
import authService from '../../services/authService';
import './LeftPanel.css';

const LeftPanel = () => {
    // In a real app, user details would come from a dedicated user profile API
    const user = authService.getCurrentUser();

    return (
        <div className="left-panel">
            <div className="user-profile">
                <h3>{user ? user.username || 'Cobra Coder' : 'Guest'}</h3>
                <p>Learning Journey: Python Basics</p>
            </div>
            <nav className="main-nav">
                <ul>
                    
                    <li><Link to="/dashboard">Dashboard Home</Link></li>
                    <li><Link to="/learning-path">My Learning Path</Link></li>
                    <li><Link to="/projects">My Projects</Link></li>
                    <li><Link to="/stats">My Stats</Link></li>
                </ul>
                <li><Link to='/Login'>Login</Link></li>
                <li><Link to='/Register'>Register</Link></li>   
            </nav>
        </div>
    );
};

export default LeftPanel;