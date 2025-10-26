import React from 'react';
import LeftPanel from './panels/LeftPanel';
import CenterPanel from './panels/CenterPanel';
import RightPanel from './panels/RightPanel';
import './Dashboard.css'; // We will create this CSS file for styling

const Dashboard = () => {
    return (
        <div className="dashboard-container">
            <LeftPanel />
            <CenterPanel />
            <RightPanel />
        </div>
    );
};

export default Dashboard;