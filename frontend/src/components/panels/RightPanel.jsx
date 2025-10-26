import React from 'react';
import { useNavigate } from 'react-router-dom';
import './RightPanel.css';

const RightPanel = () => {
    const navigate = useNavigate();

    return (
        <div className="right-panel">
            <h3>Tools</h3>
            <div className="tools-grid">
                <button className="tool-button" onClick={() => navigate('/concept-explorer')}>
                    Concept Explorer
                </button>
                <button className="tool-button" onClick={() => navigate('/Playground')}>
                    Coding Playground
                </button>
                <button className="tool-button" onClick={() => navigate('/debugging-zone')}>
                    Debugging Zone
                </button>
                <button className="tool-button" onClick={() => navigate('/quiz')}>
                    Quiz Center
                </button>
                <button className="tool-button" onClick={() => navigate('/coding')}>
                    Coding Challenges
                </button>
            </div>
        </div>
    );
};

export default RightPanel;
