import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { pharmacyAPI, prescriptionAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { FiList, FiCheckCircle, FiDollarSign, FiCpu, FiTrendingUp, FiActivity, FiMapPin, FiBell, FiPrinter, FiX, FiPackage } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

export default function PharmacyDashboard() {
  const { user } = useAuth();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('queue'); // queue, analytics
  const [orders, setOrders] = useState([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [billOrder, setBillOrder] = useState(null); // order for which to show bill modal
  const billRef = useRef(null);

  const salesChartRef = useRef(null);
  const medsChartRef = useRef(null);
  const regionChartRef = useRef(null);
  const salesChartInstance = useRef(null);
  const medsChartInstance = useRef(null);
  const regionChartInstance = useRef(null);

  useEffect(() => {
    fetchQueue();
    fetchOrders();

    const interval = setInterval(() => {
      fetchOrders();
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await pharmacyAPI.getOrdersForPharmacy(user.name);
      const formatted = res.data.map(o => {
        let medicineList = 'Routine Medication';
        let parsedMeds = [];
        try {
          parsedMeds = JSON.parse(o.medicines);
          medicineList = parsedMeds.map(m => m.name).join(', ');
        } catch (e) {
          medicineList = o.medicines || 'Prescribed Meds';
        }
        return {
          id: o.id,
          patientName: o.patientName,
          medicine: medicineList,
          parsedMeds,
          // Use real backend amounts, fall back to 0 for legacy orders
          medicineAmount: o.medicineAmount || 0,
          deliveryCharges: o.deliveryCharges || 0,
          amount: o.totalAmount || o.medicineAmount || 0,
          status: o.status,
          time: o.createdAt ? new Date(o.createdAt).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : 'Just Now',
          address: o.deliveryAddress || 'Default Address',
          region: o.deliveryAddress ? o.deliveryAddress.split(',')[0].trim() : 'Unknown Region',
          pharmacyName: o.pharmacyName,
          rawCreatedAt: o.createdAt
        };
      });

      // Notify about new PENDING orders
      const newPending = formatted.filter(o => o.status === 'PENDING').length;
      setNotificationCount(prev => {
        if (newPending > prev) return newPending;
        return prev;
      });

      setOrders(formatted);
    } catch (e) {
      console.error('Failed to load pharmacy orders', e);
    }
  };

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const res = await prescriptionAPI.getPharmacyQueue();
      setQueue(res.data);
    } catch (error) {
      toast.error('Failed to load prescription queue');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      await pharmacyAPI.updateOrderStatus(orderId, newStatus);
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      toast.success(`Order #${orderId} status updated to ${newStatus}`);
    } catch (e) {
      toast.error('Failed to update status on database');
    }
  };

  const handlePrintBill = () => {
    const printContent = billRef.current?.innerHTML;
    if (!printContent) return;
    const win = window.open('', '_blank');
    win.document.write(`
      <html>
        <head>
          <title>MedAstraX Bill - Order #${billOrder?.id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #111; }
            h1 { color: #0d9488; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th { background: #f0fdf4; padding: 10px; text-align: left; border: 1px solid #d1fae5; }
            td { padding: 10px; border: 1px solid #e5e7eb; }
            .total-row td { font-weight: bold; background: #f0fdf4; }
            .footer { margin-top: 32px; font-size: 0.85rem; color: #6b7280; }
          </style>
        </head>
        <body>${printContent}</body>
      </html>
    `);
    win.document.close();
    win.print();
  };

  const statusColor = (status) => {
    if (status === 'PENDING') return 'var(--warning)';
    if (status === 'PREPARING') return 'var(--primary)';
    if (status === 'DELIVERING') return 'var(--secondary)';
    if (status === 'COMPLETED') return 'var(--success)';
    return 'var(--text-muted)';
  };

  const completedOrders = orders.filter(o => o.status === 'COMPLETED' || o.status === 'DELIVERED');
  
  // Dynamic KPIs
  const totalRevenue = completedOrders.reduce((sum, o) => sum + o.amount, 0);

  const medsCounts = {};
  completedOrders.forEach(o => {
    if (o.parsedMeds && Array.isArray(o.parsedMeds)) {
      o.parsedMeds.forEach(m => {
        const name = m.name || 'Unknown';
        const qty = m.quantity || 1;
        medsCounts[name] = (medsCounts[name] || 0) + qty;
      });
    } else {
      const name = o.medicine || 'Prescribed Meds';
      medsCounts[name] = (medsCounts[name] || 0) + 1;
    }
  });
  let topMedicine = 'None';
  let topMedicineCount = 0;
  Object.entries(medsCounts).forEach(([name, count]) => {
    if (count > topMedicineCount) {
      topMedicine = name;
      topMedicineCount = count;
    }
  });

  const regionStats = {};
  completedOrders.forEach(o => {
    const r = o.region || 'Unknown';
    regionStats[r] = (regionStats[r] || 0) + 1;
  });
  let topRegion = 'None';
  let topRegionPercentage = 0;
  let topRegionCount = 0;
  if (completedOrders.length > 0) {
    Object.entries(regionStats).forEach(([r, count]) => {
      if (count > topRegionCount) {
        topRegion = r;
        topRegionCount = count;
      }
    });
    topRegionPercentage = Math.round((topRegionCount / completedOrders.length) * 100);
  }

  useEffect(() => {
    if (activeTab !== 'analytics' || orders.length === 0) return;

    const Chart = window.Chart;
    if (!Chart) {
      console.warn('Chart.js is not loaded yet');
      return;
    }

    if (completedOrders.length === 0) return;

    // 1. Sales Trends
    const salesByDate = {};
    const sortedCompleted = [...completedOrders].sort((a, b) => {
      return new Date(a.rawCreatedAt || 0) - new Date(b.rawCreatedAt || 0);
    });

    sortedCompleted.forEach(o => {
      let dateKey = 'Just Now';
      if (o.rawCreatedAt) {
        dateKey = new Date(o.rawCreatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      }
      salesByDate[dateKey] = (salesByDate[dateKey] || 0) + o.amount;
    });
    const salesLabels = Object.keys(salesByDate);
    const salesData = Object.values(salesByDate);

    // 2. Popular Medicines
    const sortedMeds = Object.entries(medsCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const medsLabels = sortedMeds.map(e => e[0]);
    const medsData = sortedMeds.map(e => e[1]);

    // 3. Regional Trends
    const regionLabels = Object.keys(regionStats);
    const regionData = Object.values(regionStats);

    // Cleanup previous charts
    if (salesChartInstance.current) salesChartInstance.current.destroy();
    if (medsChartInstance.current) medsChartInstance.current.destroy();
    if (regionChartInstance.current) regionChartInstance.current.destroy();

    // Render Sales Line Chart
    if (salesChartRef.current) {
      salesChartInstance.current = new Chart(salesChartRef.current, {
        type: 'line',
        data: {
          labels: salesLabels,
          datasets: [{
            label: 'Revenue (₹)',
            data: salesData,
            borderColor: '#0d9488',
            backgroundColor: 'rgba(13, 148, 136, 0.08)',
            borderWidth: 3,
            fill: true,
            tension: 0.3,
            pointBackgroundColor: '#0d9488'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: {
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: 'var(--text-secondary)' }
            },
            x: {
              grid: { display: false },
              ticks: { color: 'var(--text-secondary)' }
            }
          }
        }
      });
    }

    // Render Popular Medications Horizontal Bar Chart
    if (medsChartRef.current) {
      medsChartInstance.current = new Chart(medsChartRef.current, {
        type: 'bar',
        data: {
          labels: medsLabels,
          datasets: [{
            label: 'Quantity Sold',
            data: medsData,
            backgroundColor: 'rgba(0, 217, 166, 0.65)',
            borderColor: 'var(--primary)',
            borderWidth: 1,
            borderRadius: 6
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: {
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: 'var(--text-secondary)' }
            },
            y: {
              grid: { display: false },
              ticks: { color: 'var(--text-secondary)' }
            }
          }
        }
      });
    }

    // Render Regional Doughnut Chart
    if (regionChartRef.current) {
      regionChartInstance.current = new Chart(regionChartRef.current, {
        type: 'doughnut',
        data: {
          labels: regionLabels,
          datasets: [{
            data: regionData,
            backgroundColor: [
              'rgba(13, 148, 136, 0.7)',
              'rgba(0, 217, 166, 0.7)',
              'rgba(59, 130, 246, 0.7)',
              'rgba(249, 115, 22, 0.7)',
              'rgba(168, 85, 247, 0.7)'
            ],
            borderColor: 'var(--surface)',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: 'var(--text-secondary)',
                boxWidth: 12,
                padding: 15
              }
            }
          }
        }
      });
    }

    return () => {
      if (salesChartInstance.current) salesChartInstance.current.destroy();
      if (medsChartInstance.current) medsChartInstance.current.destroy();
      if (regionChartInstance.current) regionChartInstance.current.destroy();
    };
  }, [activeTab, orders]);

  return (
    <div className="page-container section" style={{ minHeight: '85vh' }}>

      {/* HUD Header */}
      <div className="glass-card pharmacy-header-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '32px', marginBottom: '40px' }}>
        <div>
          <h1 className="heading-lg" style={{ margin: 0 }}>Pharmacy <span className="text-gradient">Portal</span></h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '6px' }}>Manage prescriptions, price lists, and real-time orders.</p>
        </div>

        {/* Notification Bell */}
        <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setNotificationCount(0)}>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '50%', border: '1px solid var(--border-color)' }}>
            <FiBell size={24} color={notificationCount > 0 ? 'var(--primary)' : 'var(--text-secondary)'} />
          </div>
          {notificationCount > 0 && (
            <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: 'var(--danger)', color: '#fff', fontSize: '0.75rem', fontWeight: 'bold', padding: '2px 6px', borderRadius: '10px' }}>
              {notificationCount}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="dashboard-tabs" style={{ display: 'flex', gap: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '32px' }}>
        <button
          onClick={() => setActiveTab('queue')}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '12px 24px',
            background: activeTab === 'queue' ? 'rgba(var(--primary-rgb), 0.1)' : 'transparent',
            color: activeTab === 'queue' ? 'var(--primary)' : 'var(--text-secondary)',
            border: 'none',
            borderBottom: activeTab === 'queue' ? '2px solid var(--primary)' : '2px solid transparent',
            cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s',
            borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0'
          }}
        >
          <FiList /> Orders &amp; Queue
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '12px 24px',
            background: activeTab === 'history' ? 'rgba(var(--primary-rgb), 0.1)' : 'transparent',
            color: activeTab === 'history' ? 'var(--primary)' : 'var(--text-secondary)',
            border: 'none',
            borderBottom: activeTab === 'history' ? '2px solid var(--primary)' : '2px solid transparent',
            cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s',
            borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0'
          }}
        >
          <FiCheckCircle /> Order History
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '12px 24px',
            background: activeTab === 'analytics' ? 'rgba(var(--primary-rgb), 0.1)' : 'transparent',
            color: activeTab === 'analytics' ? 'var(--primary)' : 'var(--text-secondary)',
            border: 'none',
            borderBottom: activeTab === 'analytics' ? '2px solid var(--primary)' : '2px solid transparent',
            cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s',
            borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0'
          }}
        >
          <FiCpu /> AI Analytics &amp; Forecast
        </button>
      </div>

      {/* Orders & Queue Tab */}
      {activeTab === 'queue' && (
        <div className="pharmacy-main-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: '32px' }}>

          {/* Left: Active prescriptions queue */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <h2 className="heading-sm" style={{ marginBottom: '20px' }}>Active Prescription Pricing Queue</h2>
            {loading ? (
              <div className="spinner"></div>
            ) : queue.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No active prescriptions in routing.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '12px' }}>ID</th>
                      <th style={{ padding: '12px' }}>Patient Name</th>
                      <th style={{ padding: '12px' }}>Doctor Name</th>
                      <th style={{ padding: '12px' }}>Medicines</th>
                      <th style={{ padding: '12px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td data-label="ID" style={{ padding: '16px 12px' }}>#{p.id}</td>
                        <td data-label="Patient Name" style={{ padding: '16px 12px', fontWeight: 600 }}>{p.patientName}</td>
                        <td data-label="Doctor Name" style={{ padding: '16px 12px' }}>{p.doctorName}</td>
                        <td data-label="Medicines" style={{ padding: '16px 12px', color: 'var(--text-secondary)' }}>
                          {p.medicines ? (
                            p.medicines.startsWith('[') ? (
                              JSON.parse(p.medicines).map(m => m.name).join(', ')
                            ) : p.medicines
                          ) : 'Routine Check'}
                        </td>
                        <td data-label="Actions" style={{ padding: '16px 12px' }}>
                          <button className="btn btn-primary btn-sm">Submit Prices</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right: Placed Delivery orders with billing */}
          <div className="glass-card" style={{ padding: '24px', alignSelf: 'start' }}>
            <h3 className="heading-sm" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <FiPackage color="var(--primary)" /> Fulfillment Orders
            </h3>

            {orders.filter(o => o.status !== 'COMPLETED' && o.status !== 'DELIVERED').length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No active orders in fulfillment queue.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {orders.filter(o => o.status !== 'COMPLETED' && o.status !== 'DELIVERED').map(order => (
                  <div key={order.id} style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${statusColor(order.status)}33`, borderRadius: '12px', borderLeft: `4px solid ${statusColor(order.status)}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '0.95rem' }}>Order #{order.id}</strong>
                      <span style={{ fontSize: '0.72rem', background: `${statusColor(order.status)}22`, color: statusColor(order.status), padding: '2px 10px', borderRadius: '20px', fontWeight: 700, letterSpacing: '0.5px' }}>
                        {order.status}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                      <div>👤 <strong style={{ color: 'var(--text-primary)' }}>{order.patientName}</strong></div>
                      <div style={{ marginTop: '4px' }}>💊 {order.medicine}</div>
                      <div style={{ marginTop: '4px' }}>📍 {order.address}</div>
                      <div style={{ marginTop: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>🕐 {order.time}</div>
                    </div>

                    {/* Billing summary */}
                    <div style={{ background: 'rgba(0,217,166,0.04)', border: '1px solid rgba(0,217,166,0.15)', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Medicines</span>
                        <span>₹{order.medicineAmount.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '6px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Delivery Fee</span>
                        <span>₹{order.deliveryCharges.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '0.95rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '6px' }}>
                        <span>Total</span>
                        <span className="text-gradient">₹{order.amount.toFixed(2)}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {order.status === 'PENDING' && (
                        <button onClick={() => handleUpdateOrderStatus(order.id, 'PREPARING')} className="btn btn-primary btn-sm">Start Preparing</button>
                      )}
                      {order.status === 'PREPARING' && (
                        <button onClick={() => handleUpdateOrderStatus(order.id, 'DELIVERING')} className="btn btn-primary btn-sm">Mark Delivering</button>
                      )}
                      {order.status === 'DELIVERING' && (
                        <button onClick={() => handleUpdateOrderStatus(order.id, 'COMPLETED')} className="btn btn-outline btn-sm">Mark Complete</button>
                      )}
                      {order.status === 'COMPLETED' && (
                        <span style={{ color: 'var(--success)', fontSize: '0.85rem', fontWeight: 'bold' }}>✓ Delivered</span>
                      )}
                      {/* Generate Bill always available */}
                      <button
                        onClick={() => setBillOrder(order)}
                        className="btn btn-outline btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}
                      >
                        <FiDollarSign size={14} /> Generate Bill
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="glass-card animate-fade-in" style={{ padding: '24px' }}>
          <h2 className="heading-sm" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiCheckCircle color="var(--success)" /> Completed Order History
          </h2>
          {completedOrders.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No completed orders in history.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '12px' }}>Order ID</th>
                    <th style={{ padding: '12px' }}>Date &amp; Time</th>
                    <th style={{ padding: '12px' }}>Patient Name</th>
                    <th style={{ padding: '12px' }}>Medicines</th>
                    <th style={{ padding: '12px' }}>Region</th>
                    <th style={{ padding: '12px' }}>Grand Total</th>
                    <th style={{ padding: '12px' }}>Status</th>
                    <th style={{ padding: '12px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {completedOrders.map(order => (
                    <tr key={order.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td data-label="Order ID" style={{ padding: '16px 12px', fontWeight: 'bold' }}>#{order.id}</td>
                      <td data-label="Date & Time" style={{ padding: '16px 12px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{order.time}</td>
                      <td data-label="Patient Name" style={{ padding: '16px 12px', fontWeight: 600 }}>{order.patientName}</td>
                      <td data-label="Medicines" style={{ padding: '16px 12px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{order.medicine}</td>
                      <td data-label="Region" style={{ padding: '16px 12px' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}><FiMapPin size={12} color="var(--secondary)" /> {order.region}</span></td>
                      <td data-label="Grand Total" style={{ padding: '16px 12px', fontWeight: 'bold', color: 'var(--primary)' }}>₹{order.amount.toFixed(2)}</td>
                      <td data-label="Status" style={{ padding: '16px 12px' }}>
                        <span style={{ fontSize: '0.72rem', background: 'rgba(0,217,166,0.1)', color: 'var(--success)', padding: '2px 10px', borderRadius: '20px', fontWeight: 700 }}>
                          DELIVERED
                        </span>
                      </td>
                      <td data-label="Actions" style={{ padding: '16px 12px' }}>
                        <button
                          onClick={() => setBillOrder(order)}
                          className="btn btn-outline btn-sm"
                          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <FiDollarSign size={14} /> View Invoice
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }} className="animate-fade-in">

          {/* Core Analytics Cards */}
          <div className="grid grid-3">
            <div className="glass-card stat-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><FiDollarSign color="var(--primary)" /> Sales Revenue</div>
              <div className="stat-value text-gradient">₹{totalRevenue.toLocaleString('en-IN')}</div>
              <div className="stat-label">Total Completed Revenue</div>
            </div>
            <div className="glass-card stat-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><FiActivity color="var(--success)" /> Most Ordered Medication</div>
              <div className="stat-value text-gradient" style={{ fontSize: '1.5rem' }}>{topMedicine}</div>
              <div className="stat-label">{topMedicineCount} Units Sold</div>
            </div>
            <div className="glass-card stat-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><FiMapPin color="var(--secondary)" /> Highest Demand Region</div>
              <div className="stat-value text-gradient" style={{ fontSize: '1.5rem' }}>{topRegion}</div>
              <div className="stat-label">{topRegionPercentage}% of total orders</div>
            </div>
          </div>

          {/* Charts Container */}
          <div className="pharmacy-analytics-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
            <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
              <h3 className="heading-sm" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <FiTrendingUp color="var(--primary)" /> Sales Revenue Trends
              </h3>
              <div style={{ flex: 1, minHeight: '260px', position: 'relative' }}>
                <canvas ref={salesChartRef}></canvas>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
              <h3 className="heading-sm" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <FiMapPin color="var(--secondary)" /> Regional Distribution
              </h3>
              <div style={{ flex: 1, minHeight: '260px', position: 'relative' }}>
                <canvas ref={regionChartRef}></canvas>
              </div>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
            <h3 className="heading-sm" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <FiPackage color="var(--success)" /> Popular Medications Sold
            </h3>
            <div style={{ flex: 1, minHeight: '260px', position: 'relative' }}>
              <canvas ref={medsChartRef}></canvas>
            </div>
          </div>

          {/* AI regional outbreak forecasts */}
          <div className="glass-card" style={{ padding: '32px', border: '1px solid var(--primary)', background: 'rgba(0,217,166,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(0,217,166,0.1)', color: 'var(--primary)', padding: '10px', borderRadius: '50%' }}>
                <FiCpu size={24} />
              </div>
              <div>
                <h3 className="heading-sm" style={{ margin: 0 }}>AI Public Health Trend Forecaster</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>Predicting community disease outbreaks using regional purchase data.</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }}>
              <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', borderLeft: '4px solid var(--warning)' }}>
                <strong style={{ color: 'var(--warning)', fontSize: '0.9rem', display: 'block', marginBottom: '6px' }}>⚠️ Seasonal Influenza Outbreak Detected</strong>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  A 45% surge in Paracetamol and antihistamine orders in the <strong>Bandra (West)</strong> region suggests a seasonal flu outbreak.
                  We predict a <strong>30% increase</strong> in fever and cold medication demand in the next 10 days.
                  <strong> Action:</strong> Stock up on Paracetamol, Ebastine, and Cough Syrup formulations.
                </p>
              </div>

              <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', borderLeft: '4px solid var(--primary)' }}>
                <strong style={{ color: 'var(--primary)', fontSize: '0.9rem', display: 'block', marginBottom: '6px' }}>📈 Asthma &amp; Bronchial Irritation Forecast</strong>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Due to the elevated AQI indexes in <strong>Andheri West</strong>, inhalers and Levocetirizine demands have risen by 18% in the past week.
                  Predicting future demand for inhalers to remain high for the next 14 days.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Bill Modal ── */}
      <AnimatePresence>
        {billOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 1000, padding: '24px'
            }}
            onClick={(e) => { if (e.target === e.currentTarget) setBillOrder(null); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{
                background: 'var(--surface)', border: '1px solid var(--border-color)',
                borderRadius: '16px', width: '100%', maxWidth: '560px',
                overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.5)'
              }}
            >
              {/* Modal header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FiDollarSign color="var(--primary)" /> Invoice — Order #{billOrder.id}
                </h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={handlePrintBill} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FiPrinter size={14} /> Print / Save PDF
                  </button>
                  <button onClick={() => setBillOrder(null)} className="btn btn-ghost btn-icon"><FiX /></button>
                </div>
              </div>

              {/* Bill content (also used for printing) */}
              <div style={{ padding: '28px 24px' }} ref={billRef}>
                {/* Pharmacy header */}
                <div style={{ marginBottom: '20px', borderBottom: '2px solid var(--primary)', paddingBottom: '16px' }}>
                  <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 4px 0' }}>
                    <span style={{ color: 'var(--primary)' }}>MedAstraX</span> — Tax Invoice
                  </h1>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {billOrder.pharmacyName} &nbsp;|&nbsp; GST Reg. No: 27AABCU9603R1ZX
                  </p>
                </div>

                {/* Patient info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block' }}>Bill To</span>
                    <strong>{billOrder.patientName}</strong>
                    <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>{billOrder.address}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block' }}>Invoice Date</span>
                    <strong>{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                    <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>Invoice #{billOrder.id}-{new Date().getFullYear()}</div>
                  </div>
                </div>

                {/* Medicines table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: '16px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '8px 0', textAlign: 'left', fontWeight: 600 }}>Medicine</th>
                      <th style={{ padding: '8px', textAlign: 'center', fontWeight: 600 }}>Dosage</th>
                      <th style={{ padding: '8px', textAlign: 'center', fontWeight: 600 }}>Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(billOrder.parsedMeds || []).map((m, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td data-label="Medicine" style={{ padding: '10px 0', fontWeight: 500 }}>{m.name || '—'}</td>
                        <td data-label="Dosage" style={{ padding: '10px', textAlign: 'center', color: 'var(--text-secondary)' }}>{m.dosage || '—'}</td>
                        <td data-label="Duration" style={{ padding: '10px', textAlign: 'center', color: 'var(--text-secondary)' }}>{m.duration || '—'}</td>
                      </tr>
                    ))}
                    {(!billOrder.parsedMeds || billOrder.parsedMeds.length === 0) && (
                      <tr>
                        <td data-label="Message" colSpan={3} style={{ padding: '12px 0', color: 'var(--text-muted)' }}>Prescribed medications</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Totals */}
                <div style={{ background: 'rgba(0,217,166,0.04)', border: '1px solid rgba(0,217,166,0.2)', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Medicines Subtotal</span>
                    <span>₹{billOrder.medicineAmount.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Delivery Charges</span>
                    <span>₹{billOrder.deliveryCharges.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '12px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>GST (5%)</span>
                    <span>₹{(billOrder.medicineAmount * 0.05).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.1rem', borderTop: '1px solid rgba(0,217,166,0.3)', paddingTop: '12px' }}>
                    <span>Grand Total</span>
                    <span style={{ color: 'var(--primary)', fontSize: '1.25rem' }}>
                      ₹{(billOrder.amount + billOrder.medicineAmount * 0.05).toFixed(2)}
                    </span>
                  </div>
                </div>

                <p style={{ marginTop: '16px', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  Thank you for using MedAstraX. This is a computer-generated invoice and does not require a signature.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
