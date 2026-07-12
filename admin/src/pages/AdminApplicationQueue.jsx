/**
 * AdminApplicationQueue.jsx — Delivery Partner Application Queue Management
 * View, review, approve, and reject delivery partner applications
 */

import { useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import axios from 'axios';
import '../styles/AdminApplicationQueue.css';

export default function AdminApplicationQueue() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState(null);
  const [filter, setFilter] = useState('submitted');
  const [stats, setStats] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const { ws } = useWebSocket();

  // Fetch applications on mount and filter change
  useEffect(() => {
    fetchApplications();
  }, [filter]);

  // Listen for realtime application updates
  useEffect(() => {
    if (!ws) return;

    const handleMessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'delivery:application_status_changed') {
          // Refresh applications when status changes
          fetchApplications();
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    };

    ws.addEventListener('message', handleMessage);

    return () => {
      ws.removeEventListener('message', handleMessage);
    };
  }, [ws]);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/admin/delivery/applications', {
        params: { status: filter }
      });
      setApplications(response.data.data || []);
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/admin/delivery/applications/stats');
      setStats(response.data.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const approveApplication = async (appId) => {
    try {
      setActionLoading(true);
      const notes = prompt('Enter approval notes (optional):');

      const response = await axios.post(`/api/admin/delivery/applications/${appId}/approve`, {
        notes: notes || ''
      });

      if (response.data.success) {
        alert('Application approved successfully');
        fetchApplications();
        setSelectedApp(null);
      }
    } catch (error) {
      alert('Error approving application: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const rejectApplication = async (appId) => {
    try {
      setActionLoading(true);
      const reason = prompt('Enter rejection reason (required):');

      if (!reason) {
        alert('Rejection reason is required');
        return;
      }

      const response = await axios.post(`/api/admin/delivery/applications/${appId}/reject`, {
        reason
      });

      if (response.data.success) {
        alert('Application rejected');
        fetchApplications();
        setSelectedApp(null);
      }
    } catch (error) {
      alert('Error rejecting application: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="admin-application-queue">
      <div className="queue-header">
        <h1>Delivery Partner Applications</h1>
        {stats && (
          <div className="stats-summary">
            <div className="stat-item">
              <span className="label">Pending</span>
              <span className="value">{stats.submitted || 0}</span>
            </div>
            <div className="stat-item">
              <span className="label">Under Review</span>
              <span className="value">{stats.under_review || 0}</span>
            </div>
            <div className="stat-item">
              <span className="label">Approved</span>
              <span className="value">{stats.approved || 0}</span>
            </div>
            <div className="stat-item">
              <span className="label">Rejected</span>
              <span className="value">{stats.rejected || 0}</span>
            </div>
          </div>
        )}
      </div>

      <div className="queue-content">
        {/* Left: Application List */}
        <div className="applications-list">
          <div className="filter-tabs">
            {['submitted', 'under_review', 'approved', 'rejected'].map((status) => (
              <button
                key={status}
                className={`filter-btn ${filter === status ? 'active' : ''}`}
                onClick={() => setFilter(status)}
              >
                {status.replace('_', ' ').toUpperCase()}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="loading">Loading applications...</div>
          ) : applications.length === 0 ? (
            <div className="empty-state">No applications found</div>
          ) : (
            <div className="app-list">
              {applications.map((app) => (
                <div
                  key={app._id}
                  className={`app-card ${selectedApp?._id === app._id ? 'selected' : ''}`}
                  onClick={() => setSelectedApp(app)}
                >
                  <div className="app-header">
                    <h3>{app.personal?.fullName || 'Unknown'}</h3>
                    <span className={`status-badge status-${app.status}`}>{app.status}</span>
                  </div>
                  <div className="app-info">
                    <p>📞 {app.personal?.phone || 'N/A'}</p>
                    <p>🏙️ {app.address?.city || 'N/A'}</p>
                    <p>🚗 {app.vehicle?.vehicleType || 'N/A'}</p>
                  </div>
                  <div className="app-date">
                    {new Date(app.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Application Details */}
        <div className="application-detail">
          {selectedApp ? (
            <div className="detail-content">
              <h2>Application Details</h2>

              {/* Personal Information */}
              <section className="detail-section">
                <h3>Personal Information</h3>
                <div className="detail-grid">
                  <div className="field">
                    <label>Full Name</label>
                    <p>{selectedApp.personal?.fullName || 'N/A'}</p>
                  </div>
                  <div className="field">
                    <label>Phone</label>
                    <p>{selectedApp.personal?.phone || 'N/A'}</p>
                  </div>
                  <div className="field">
                    <label>Email</label>
                    <p>{selectedApp.personal?.email || 'N/A'}</p>
                  </div>
                  <div className="field">
                    <label>Date of Birth</label>
                    <p>{selectedApp.personal?.dateOfBirth ? new Date(selectedApp.personal.dateOfBirth).toLocaleDateString() : 'N/A'}</p>
                  </div>
                </div>
              </section>

              {/* Address */}
              <section className="detail-section">
                <h3>Address</h3>
                <div className="detail-grid">
                  <div className="field">
                    <label>Area</label>
                    <p>{selectedApp.address?.area || 'N/A'}</p>
                  </div>
                  <div className="field">
                    <label>City</label>
                    <p>{selectedApp.address?.city || 'N/A'}</p>
                  </div>
                  <div className="field">
                    <label>Pincode</label>
                    <p>{selectedApp.address?.pincode || 'N/A'}</p>
                  </div>
                  <div className="field">
                    <label>State</label>
                    <p>{selectedApp.address?.state || 'N/A'}</p>
                  </div>
                </div>
              </section>

              {/* Vehicle */}
              <section className="detail-section">
                <h3>Vehicle Information</h3>
                <div className="detail-grid">
                  <div className="field">
                    <label>Type</label>
                    <p>{selectedApp.vehicle?.vehicleType || 'N/A'}</p>
                  </div>
                  <div className="field">
                    <label>Number</label>
                    <p>{selectedApp.vehicle?.vehicleNumber || 'N/A'}</p>
                  </div>
                  <div className="field">
                    <label>Model</label>
                    <p>{selectedApp.vehicle?.vehicleModel || 'N/A'}</p>
                  </div>
                </div>
              </section>

              {/* Bank Details */}
              <section className="detail-section">
                <h3>Bank Details</h3>
                <div className="detail-grid">
                  <div className="field">
                    <label>Account Holder</label>
                    <p>{selectedApp.bank?.accountHolder || 'N/A'}</p>
                  </div>
                  <div className="field">
                    <label>Bank Name</label>
                    <p>{selectedApp.bank?.bankName || 'N/A'}</p>
                  </div>
                  <div className="field">
                    <label>IFSC</label>
                    <p>{selectedApp.bank?.ifsc || 'N/A'}</p>
                  </div>
                  <div className="field">
                    <label>UPI ID</label>
                    <p>{selectedApp.bank?.upiId || 'N/A'}</p>
                  </div>
                </div>
              </section>

              {/* Actions */}
              {selectedApp.status === 'submitted' && (
                <div className="action-buttons">
                  <button
                    className="btn btn-approve"
                    onClick={() => approveApplication(selectedApp._id)}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Processing...' : '✅ Approve'}
                  </button>
                  <button
                    className="btn btn-reject"
                    onClick={() => rejectApplication(selectedApp._id)}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Processing...' : '❌ Reject'}
                  </button>
                </div>
              )}

              {selectedApp.status === 'approved' && (
                <div className="status-message approved">
                  ✅ This application has been approved
                </div>
              )}

              {selectedApp.status === 'rejected' && (
                <div className="status-message rejected">
                  ❌ This application has been rejected
                </div>
              )}
            </div>
          ) : (
            <div className="empty-detail">
              <p>Select an application to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
