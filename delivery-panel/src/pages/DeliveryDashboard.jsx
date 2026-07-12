/**
 * DeliveryDashboard.jsx — Delivery Partner Main Dashboard
 */

import { useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import axios from 'axios';
import '../styles/DeliveryDashboard.css';

export default function DeliveryDashboard() {
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const { ws } = useWebSocket();

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Listen for order assignments in realtime
  useEffect(() => {
    if (!ws) return;

    const handleOrderAssignment = (event) => {
      if (event.type === 'delivery:order_assigned') {
        // Refresh orders when new order is assigned
        fetchOrders();
      }
    };

    ws.addEventListener('message', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.event === 'rider:order_assigned') {
          handleOrderAssignment(data);
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    });

    return () => {
      ws.removeEventListener('message', handleOrderAssignment);
    };
  }, [ws]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [profileRes, ordersRes, statsRes] = await Promise.all([
        axios.get('/api/delivery/status'),
        axios.get('/api/delivery/orders/active'),
        axios.get('/api/delivery/earnings'),
      ]);

      setProfile(profileRes.data);
      setOrders(ordersRes.data.data || []);
      setStats(statsRes.data);
      setIsOnline(profileRes.data.isOnline || false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleOnlineStatus = async () => {
    try {
      const response = await axios.patch('/api/delivery/toggle-status');
      if (response.data.success) {
        setIsOnline(!isOnline);
        // Notify via realtime
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            event: 'delivery:status_update',
            isOnline: !isOnline,
          }));
        }
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const acceptOrder = async (orderId) => {
    try {
      const response = await axios.post(`/api/delivery/orders/${orderId}/accept`);
      if (response.data.success) {
        alert('Order accepted!');
        fetchOrders();
      }
    } catch (error) {
      alert('Error accepting order: ' + error.message);
    }
  };

  const rejectOrder = async (orderId) => {
    try {
      const response = await axios.post(`/api/delivery/orders/${orderId}/reject`);
      if (response.data.success) {
        alert('Order rejected');
        fetchOrders();
      }
    } catch (error) {
      alert('Error rejecting order: ' + error.message);
    }
  };

  if (loading) {
    return <div className="dashboard loading">Loading dashboard...</div>;
  }

  return (
    <div className="delivery-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-left">
          <h1>Delivery Dashboard</h1>
          <p>Welcome, {profile?.name || 'Partner'}</p>
        </div>
        <div className="header-right">
          <button
            className={`online-toggle ${isOnline ? 'active' : 'inactive'}`}
            onClick={toggleOnlineStatus}
          >
            <div className="status-indicator"></div>
            {isOnline ? 'Online' : 'Offline'}
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">📦</div>
            <div className="stat-content">
              <div className="stat-label">Today's Deliveries</div>
              <div className="stat-value">{stats.todayDeliveries || 0}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">💰</div>
            <div className="stat-content">
              <div className="stat-label">Today's Earnings</div>
              <div className="stat-value">₹{stats.todayEarnings || 0}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">⭐</div>
            <div className="stat-content">
              <div className="stat-label">Rating</div>
              <div className="stat-value">{stats.rating?.toFixed(1) || 5.0}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">📈</div>
            <div className="stat-content">
              <div className="stat-label">This Week's Earnings</div>
              <div className="stat-value">₹{stats.weekEarnings || 0}</div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="dashboard-content">
        {/* Active Orders */}
        <div className="section">
          <h2>Active Orders</h2>
          {orders.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <p>No active orders right now</p>
              <p className="empty-hint">{isOnline ? 'Orders will appear here when available' : 'Go online to receive orders'}</p>
            </div>
          ) : (
            <div className="orders-list">
              {orders.map((order) => (
                <div key={order._id} className="order-card">
                  <div className="order-header">
                    <div className="order-id">Order #{order._id?.slice(-6).toUpperCase()}</div>
                    <span className={`order-status status-${order.delivery?.status}`}>
                      {order.delivery?.status || 'PENDING'}
                    </span>
                  </div>

                  <div className="order-details">
                    <div className="detail-row">
                      <span className="label">Customer</span>
                      <span className="value">{order.customerName || 'Unknown'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Phone</span>
                      <span className="value">{order.phone || 'N/A'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Items</span>
                      <span className="value">{order.items?.length || 0}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Distance</span>
                      <span className="value">{order.delivery?.distanceKm?.toFixed(1) || 'N/A'} km</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Address</span>
                      <span className="value">{order.address?.slice(0, 50) || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="order-actions">
                    {order.delivery?.status === 'ASSIGNED' && (
                      <>
                        <button
                          className="btn btn-primary"
                          onClick={() => acceptOrder(order._id)}
                        >
                          ✓ Accept
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => rejectOrder(order._id)}
                        >
                          ✗ Reject
                        </button>
                      </>
                    )}

                    {order.delivery?.status === 'ASSIGNED' && (
                      <button className="btn btn-info">
                        📍 View Location
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div className="quick-links-section">
          <h2>Quick Links</h2>
          <div className="quick-links">
            <a href="/delivery/earnings" className="quick-link">
              <span className="icon">💸</span>
              <span>View Earnings</span>
            </a>
            <a href="/delivery/profile" className="quick-link">
              <span className="icon">👤</span>
              <span>My Profile</span>
            </a>
            <a href="/delivery/wallet" className="quick-link">
              <span className="icon">💳</span>
              <span>Wallet</span>
            </a>
            <a href="/delivery/notifications" className="quick-link">
              <span className="icon">🔔</span>
              <span>Notifications</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
