
import React, { useEffect, useState } from "react";
import axios from "axios";

export default function PlanSidebar({ isOpen, onClose, onSelectPlan }) {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchPlans();
        }
    }, [isOpen]);

    const fetchPlans = async () => {
        setLoading(true);
        try {
            const userData = JSON.parse(localStorage.getItem("user"));
            const token = userData?.access;
            if (!token) return;

            const res = await axios.get("http://localhost:8000/api/code/user-plans/", {
                headers: { Authorization: `Bearer ${token}` },
            });
            setPlans(res.data);
        } catch (err) {
            console.error("Failed to fetch plans", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Backdrop for mobile or focus */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40"
                    onClick={onClose}
                />
            )}

            {/* Sidebar Drawer */}
            <div
                className={`fixed top-0 left-0 h-full w-80 bg-gray-900 border-r border-gray-800 z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? "translate-x-0" : "-translate-x-full"
                    } shadow-2xl flex flex-col`}
            >
                <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-950">
                    <h2 className="text-lg font-bold text-white">📚 Saved Plans</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        ✕
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {loading ? (
                        <div className="text-center text-gray-500 py-4">Loading plans...</div>
                    ) : plans.length === 0 ? (
                        <div className="text-center text-gray-500 py-4">No saved plans found. Start a new topic!</div>
                    ) : (
                        plans.map((plan) => (
                            <div
                                key={plan.id}
                                onClick={() => {
                                    onSelectPlan(plan.id);
                                    onClose();
                                }}
                                className="p-3 bg-gray-800 hover:bg-gray-750 rounded-lg cursor-pointer border border-gray-700 hover:border-indigo-500 transition group"
                            >
                                <h3 className="font-semibold text-gray-200 group-hover:text-indigo-400 truncate">
                                    {plan.topic}
                                </h3>
                                <div className="flex justify-between items-center mt-2 text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded-full ${plan.is_completed ? 'bg-green-900 text-green-300' : 'bg-indigo-900 text-indigo-300'}`}>
                                            {plan.progress} Completed
                                        </span>
                                    </div>
                                    <span className="text-gray-500">{new Date(plan.created_at).toLocaleDateString()}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </>
    );
}
