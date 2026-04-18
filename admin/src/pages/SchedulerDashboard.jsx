/**
 * 🤖 AUTOMATION SCHEDULER DASHBOARD
 * Admin panel component to monitor all cron jobs
 * Location: admin/src/components/SchedulerDashboard.jsx (or admin/src/pages)
 */

import { useState, useEffect } from 'react';
import api from '../api/adminApi';
import { FaBolt, FaCheckCircle, FaClock, FaExclamationTriangle, FaRefresh } from 'react-icons/fa';

const CSS = `
.autom-root {
    font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
    padding: 24px;
    background: #f5f7fa;
    min-height: 100vh;
}

.autom-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 32px;
}

.autom-title {
    font-size: 28px;
    font-weight: 800;
    color: #111827;
    display: flex;
    align-items: center;
    gap: 12px;
}

.autom-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    margin-bottom: 32px;
}

.autom-stat-card {
    background: #fff;
    border: 1px solid #e8edf2;
    border-radius: 12px;
    padding: 20px;
    display: flex;
    flex-direction: column;
}

.autom-stat-icon {
    font-size: 28px;
    margin-bottom: 8px;
}

.autom-stat-value {
    font-size: 24px;
    font-weight: 800;
    color: #111827;
}

.autom-stat-label {
    font-size: 12px;
    color: #6b7280;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-top: 4px;
}

.autom-jobs-grid {
    display: grid;
    gap: 16px;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
}

.autom-job {
    background: #fff;
    border: 1px solid #e8edf2;
    border-radius: 12px;
    padding: 16px;
    transition: all .2s;
}

.autom-job:hover {
    box-shadow: 0 8px 24px rgba(0,0,0,.08);
    border-color: #d1d5db;
}

.autom-job-header {
    display: flex;
    justify-content: space-between;
    align-items: start;
    margin-bottom: 12px;
}

.autom-job-name {
    font-size: 14px;
    font-weight: 700;
    color: #111827;
    flex: 1;
}

.autom-job-status {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 700;
    padding: 4px 8px;
    background: #dcfce7;
    color: #166534;
    border-radius: 4px;
}

.autom-job-schedule {
    font-size: 12px;
    color: #6b7280;
    margin-bottom: 8px;
    font-family: 'Courier New', monospace;
    background: #f9fafb;
    padding: 4px 8px;
    border-radius: 4px;
}

.autom-job-desc {
    font-size: 12px;
    color: #6b7280;
    line-height: 1.5;
    margin-bottom: 10px;
}

.autom-job-times {
    display: flex;
    gap: 16px;
    font-size: 11px;
    color: #9ca3af;
}

.autom-refresh-btn {
    padding: 10px 20px;
    background: #5b5bf6;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all .2s;
}

.autom-refresh-btn:hover {
    background: #4949d6;
    transform: translateY(-2px);
}

.autom-loading {
    text-align: center;
    padding: 40px;
    color: #6b7280;
}

.autom-spinner {
    display: inline-block;
    animation: autom-spin 1s linear infinite;
}

@keyframes autom-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

@media(max-width:768px) {
    .autom-jobs-grid {
        grid-template-columns: 1fr;
    }
    
    .autom-header {
        flex-direction: column;
        gap: 16px;
        align-items: flex-start;
    }
}
`;

const SchedulerDashboard = () => {
    const [stats, setStats] = useState(null);
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(new Date());

    const fetchData = async () => {
        try {
            setLoading(true);
            const [statsRes, jobsRes] = await Promise.all([
                api.get('/admin/scheduler/status'),
                api.get('/admin/scheduler/jobs'),
            ]);

            setStats(statsRes.data.data);
            setJobs(jobsRes.data.jobs);
            setLastUpdated(new Date());
            setError(null);
        } catch (err) {
            setError('Failed to load scheduler data');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // Refresh every 30 seconds
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading && !stats) {
        return (
            <div className="autom-root">
                <style>{CSS}</style>
                <div className="autom-loading">
                    <FaBolt size={40} className="autom-spinner" />
                    <p>Loading scheduler data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="autom-root">
            <style>{CSS}</style>

            <div className="autom-header">
                <h1 className="autom-title">
                    <FaBolt color="#5b5bf6" />
                    Production Automation Scheduler
                </h1>
                <button className="autom-refresh-btn" onClick={fetchData} disabled={loading}>
                    <FaRefresh className={loading ? 'autom-spinner' : ''} />
                    {loading ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>

            {error && (
                <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                    {error}
                </div>
            )}

            {stats && (
                <div className="autom-stats">
                    <div className="autom-stat-card">
                        <div className="autom-stat-icon">⚙️</div>
                        <div className="autom-stat-value">{stats.total}</div>
                        <div className="autom-stat-label">Total Jobs</div>
                    </div>
                    <div className="autom-stat-card">
                        <div className="autom-stat-icon">✅</div>
                        <div className="autom-stat-value">{stats.completed}</div>
                        <div className="autom-stat-label">Completed</div>
                    </div>
                    <div className="autom-stat-card">
                        <div className="autom-stat-icon">▶️</div>
                        <div className="autom-stat-value">{stats.running}</div>
                        <div className="autom-stat-label">Running</div>
                    </div>
                    <div className="autom-stat-card">
                        <div className="autom-stat-icon">❌</div>
                        <div className="autom-stat-value">{stats.failed}</div>
                        <div className="autom-stat-label">Failed</div>
                    </div>
                </div>
            )}

            <div>
                <div className="autom-title" style={{ fontSize: '18px', marginBottom: '16px' }}>
                    All Scheduled Jobs
                </div>
                <div className="autom-jobs-grid">
                    {jobs.map((job, idx) => (
                        <div key={idx} className="autom-job">
                            <div className="autom-job-header">
                                <div className="autom-job-name">{job.name}</div>
                                <div className="autom-job-status">
                                    <FaCheckCircle size={10} />
                                    {job.enabled ? 'Enabled' : 'Disabled'}
                                </div>
                            </div>

                            <div className="autom-job-schedule">
                                <FaClock size={10} style={{ marginRight: '4px' }} />
                                {job.schedule}
                            </div>

                            <div className="autom-job-desc">
                                {job.description}
                            </div>

                            <div className="autom-job-times">
                                {job.lastRun && (
                                    <div>
                                        Last Run: {new Date(job.lastRun).toLocaleTimeString()}
                                    </div>
                                )}
                                {job.nextRun && (
                                    <div>
                                        Next Run: {new Date(job.nextRun).toLocaleTimeString()}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ marginTop: '24px', fontSize: '12px', color: '#9ca3af' }}>
                Last updated: {lastUpdated.toLocaleTimeString()}
            </div>
        </div>
    );
};

export default SchedulerDashboard;
