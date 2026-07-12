/**
 * AUTOMATION SCHEDULER DASHBOARD
 * Admin panel component to monitor all cron jobs
 * Location: admin/src/pages/SchedulerDashboard.jsx
 */

import { useState, useEffect } from 'react';
import api from '../api/adminApi';
import { FaBolt, FaClock, FaSyncAlt as FaRefresh } from 'react-icons/fa';
import { Button, Badge, Card, CardHeader, EmptyState, ErrorState, Skeleton } from '../components/ui';

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
            <div style={{ fontFamily: 'var(--adm-font-sans)', padding: 24, minHeight: '100vh' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                    <Skeleton width={280} height={28} />
                    <Skeleton width={110} height={38} radius="var(--adm-radius-md)" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
                    {[0, 1, 2, 3].map(i => (
                        <Card key={i}>
                            <Skeleton width={60} height={28} style={{ marginBottom: 8 }} />
                            <Skeleton width={80} height={12} />
                        </Card>
                    ))}
                </div>
                <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                    {[0, 1, 2].map(i => (
                        <Card key={i}>
                            <Skeleton width="70%" height={16} style={{ marginBottom: 12 }} />
                            <Skeleton width="50%" height={12} style={{ marginBottom: 10 }} />
                            <Skeleton width="100%" height={12} />
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div style={{ fontFamily: 'var(--adm-font-sans)', color: 'var(--adm-text-primary)', padding: 24, minHeight: '100vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--adm-text-primary)', display: 'flex', alignItems: 'center', gap: 12, margin: 0 }}>
                    <FaBolt color="var(--adm-primary)" />
                    Production Automation Scheduler
                </h1>
                <Button variant="primary" icon={FaRefresh} loading={loading} onClick={fetchData}>
                    {loading ? 'Refreshing...' : 'Refresh'}
                </Button>
            </div>

            {error && (
                <div style={{ marginBottom: 16 }}>
                    <ErrorState message={error} onRetry={fetchData} />
                </div>
            )}

            {stats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
                    <Card>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>⚙️</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--adm-text-primary)' }}>{stats.total}</div>
                        <div style={{ fontSize: 12, color: 'var(--adm-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 4 }}>Total Jobs</div>
                    </Card>
                    <Card>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--adm-text-primary)' }}>{stats.completed}</div>
                        <div style={{ fontSize: 12, color: 'var(--adm-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 4 }}>Completed</div>
                    </Card>
                    <Card>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>▶️</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--adm-text-primary)' }}>{stats.running}</div>
                        <div style={{ fontSize: 12, color: 'var(--adm-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 4 }}>Running</div>
                    </Card>
                    <Card>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>❌</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--adm-text-primary)' }}>{stats.failed}</div>
                        <div style={{ fontSize: 12, color: 'var(--adm-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 4 }}>Failed</div>
                    </Card>
                </div>
            )}

            <div>
                <CardHeader title="All Scheduled Jobs" />
                {jobs.length === 0 ? (
                    <EmptyState title="No scheduled jobs" description="No cron jobs are currently registered." />
                ) : (
                    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                        {jobs.map((job, idx) => (
                            <Card key={idx}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 8 }}>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--adm-text-primary)', flex: 1 }}>{job.name}</div>
                                    <Badge tone={job.enabled ? 'success' : 'neutral'} dot>
                                        {job.enabled ? 'Enabled' : 'Disabled'}
                                    </Badge>
                                </div>

                                <div style={{ fontSize: 12, color: 'var(--adm-text-secondary)', marginBottom: 8, fontFamily: "'Courier New', monospace", background: 'var(--adm-surface-alt)', padding: '4px 8px', borderRadius: 'var(--adm-radius-sm)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <FaClock size={10} />
                                    {job.schedule}
                                </div>

                                <div style={{ fontSize: 12, color: 'var(--adm-text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>
                                    {job.description}
                                </div>

                                <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--adm-muted)' }}>
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
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <div style={{ marginTop: 24, fontSize: 12, color: 'var(--adm-muted)' }}>
                Last updated: {lastUpdated.toLocaleTimeString()}
            </div>
        </div>
    );
};

export default SchedulerDashboard;
