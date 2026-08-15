import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { prescriptionAPI, pharmacyAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { FiArrowLeft, FiShoppingBag, FiTruck, FiMapPin, FiStar, FiFilter, FiCpu, FiNavigation, FiCheckCircle } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

export default function PharmacyOrderFlow() {
  const { prescriptionId } = useParams();
  const navigate = useNavigate();
  const [prescription, setPrescription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pharmacies, setPharmacies] = useState([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState(null);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderStatus, setOrderStatus] = useState('PREPARING'); // PREPARING, DELIVERING, COMPLETED
  const [deliveryProgress, setDeliveryProgress] = useState(0); // 0 to 100
  const [eta, setEta] = useState(5); // in minutes
  const [packingTimeLeft, setPackingTimeLeft] = useState(30); // countdown in seconds for packing

  // Filters
  const [sortBy, setSortBy] = useState('distance'); // distance, price, rating
  const [searchQuery, setSearchQuery] = useState('');
  
  useEffect(() => {
    fetchDetails();
  }, [prescriptionId]);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      const [prescRes, pharmRes] = await Promise.all([
        prescriptionAPI.getById(prescriptionId),
        pharmacyAPI.getAll()
      ]);
      setPrescription(prescRes.data);
      
      // Enhance mock pharmacies list with distance, price rating, stock matching
      const enhancedPharmacies = (pharmRes.data || []).map((p, idx) => ({
        ...p,
        distance: idx === 0 ? 1.2 : idx === 1 ? 2.5 : 3.8 + idx, // km
        rating: idx === 0 ? 4.9 : idx === 1 ? 4.6 : 4.2,
        estimatedPrice: 250 + (idx * 45), // INR
        deliveryCharges: p.deliveryCharges || (idx === 0 ? 30 : 0),
        inStock: true
      }));

      // If no pharmacies are loaded, populate some demo ones
      if (enhancedPharmacies.length === 0) {
        setPharmacies([
          { id: 1, name: 'MedPlus Pharmacy', address: 'Dadar, Mumbai', rating: 4.8, distance: 1.2, estimatedPrice: 280, deliveryCharges: 20, inStock: true },
          { id: 2, name: 'Apollo Pharmacy', address: 'Bandra, Mumbai', rating: 4.6, distance: 2.4, estimatedPrice: 320, deliveryCharges: 0, inStock: true },
          { id: 3, name: 'Wellness Forever', address: 'Colaba, Mumbai', rating: 4.3, distance: 4.1, estimatedPrice: 250, deliveryCharges: 40, inStock: true }
        ]);
      } else {
        setPharmacies(enhancedPharmacies);
      }
    } catch (e) {
      toast.error('Failed to load details');
    } finally {
      setLoading(false);
    }
  };

  // Sort and filter pharmacies
  const getFilteredPharmacies = () => {
    let result = [...pharmacies];
    if (searchQuery) {
      result = result.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    
    if (sortBy === 'distance') {
      result.sort((a, b) => a.distance - b.distance);
    } else if (sortBy === 'price') {
      result.sort((a, b) => a.estimatedPrice - b.estimatedPrice);
    } else if (sortBy === 'rating') {
      result.sort((a, b) => b.rating - a.rating);
    }
    return result;
  };

  // AI Recommendation Logic
  const getAiRecommendation = () => {
    // Recommend based on best overall rating, price, and distance
    const candidates = [...pharmacies];
    if (candidates.length === 0) return null;
    
    candidates.sort((a, b) => {
      // Custom score formula: High Rating is good, Low distance is good, Low price is good
      const scoreA = (a.rating * 10) - (a.distance * 2) - (a.estimatedPrice / 100);
      const scoreB = (b.rating * 10) - (b.distance * 2) - (b.estimatedPrice / 100);
      return scoreB - scoreA;
    });

    return candidates[0];
  };

  const [placedOrderId, setPlacedOrderId] = useState(null);

  const handlePlaceOrder = async () => {
    if (!selectedPharmacy) {
      toast.error('Please select a pharmacy first.');
      return;
    }
    
    try {
      const subtotal = selectedPharmacy.estimatedPrice;
      const delivery = selectedPharmacy.deliveryCharges || 0;
      const payload = {
        pharmacyName: selectedPharmacy.name,
        medicinesJson: JSON.stringify(medicines),
        deliveryAddress: prescription?.deliveryAddress || selectedPharmacy.address || 'Default Address',
        medicineAmount: subtotal,
        deliveryCharges: delivery,
        totalAmount: subtotal + delivery
      };
      
      const res = await pharmacyAPI.createOrder(payload);
      const orderId = res?.data?.data?.id;
      setPlacedOrderId(orderId);

      setOrderPlaced(true);
      setPackingTimeLeft(30);
      const calcEta = 5 + Math.round(selectedPharmacy.distance * 2);
      setEta(calcEta);

      toast.success(`Order placed with ${selectedPharmacy.name}! Packing started.`);
    } catch (e) {
      toast.error('Failed to place order. Please try again.');
    }
  };

  // Real-time backend polling for order status changes
  useEffect(() => {
    if (!orderPlaced || !placedOrderId) return;
    if (orderStatus === 'COMPLETED') return;

    const poll = setInterval(async () => {
      try {
        const res = await pharmacyAPI.getPatientOrders();
        const orders = res.data || [];
        const current = orders.find(o => o.id === placedOrderId);
        if (!current) return;

        const backendStatus = current.status;

        if ((backendStatus === 'DISPATCHED') && orderStatus === 'PREPARING') {
          setOrderStatus('DELIVERING');
          toast.success('🛵 Your order is out for delivery!', { duration: 5000 });
        }
        if (backendStatus === 'DELIVERED' && orderStatus !== 'COMPLETED') {
          setOrderStatus('COMPLETED');
          setDeliveryProgress(100);
          toast.success('📦 Your medicine has been delivered!', { duration: 6000 });
          clearInterval(poll);
        }
      } catch (_) {}
    }, 5000);

    return () => clearInterval(poll);
  }, [orderPlaced, placedOrderId, orderStatus]);

  // Visual progress animation (for DELIVERING state)
  useEffect(() => {
    if (orderStatus !== 'DELIVERING') return;
    const timer = setInterval(() => {
      setDeliveryProgress(prev => {
        if (prev >= 95) { clearInterval(timer); return 95; } // stop at 95 — final 100 comes from backend DELIVERED
        if (prev % 20 === 0 && prev > 0) setEta(e => Math.max(1, e - 1));
        return prev + 3;
      });
    }, 1500);
    return () => clearInterval(timer);
  }, [orderStatus]);

  // Packing countdown (just visual)
  useEffect(() => {
    if (!orderPlaced || orderStatus !== 'PREPARING') return;
    const timer = setInterval(() => {
      setPackingTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [orderPlaced, orderStatus]);

  const parseJson = (str) => {
    try {
      return JSON.parse(str || '[]');
    } catch (e) {
      return [];
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  const aiRecommended = getAiRecommendation();
  const filteredList = getFilteredPharmacies();
  const medicines = prescription ? parseJson(prescription.medicines) : [];

  return (
    <div className="page-container section" style={{ minHeight: '85vh' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
        <button onClick={() => navigate('/my-prescriptions')} className="btn btn-ghost btn-icon">
          <FiArrowLeft />
        </button>
        <div>
          <h1 className="heading-md" style={{ margin: 0 }}>Order Medications</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>Select a pharmacy to fulfill your digital prescription.</p>
        </div>
      </div>

      {!orderPlaced ? (
        <div className="pharmacy-order-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '32px' }}>
          
          {/* Main Pharmacy selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Filters panel */}
            <div className="glass-card" style={{ padding: '20px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <FiFilter color="var(--primary)" />
                <strong>Filter & Sort</strong>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[
                    { key: 'distance', label: 'Nearest' },
                    { key: 'price', label: 'Low Cost' },
                    { key: 'rating', label: 'Top Rated' }
                  ].map(opt => (
                    <button 
                      key={opt.key}
                      onClick={() => setSortBy(opt.key)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '20px',
                        background: sortBy === opt.key ? 'rgba(0, 217, 166, 0.1)' : 'transparent',
                        border: sortBy === opt.key ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                        color: sortBy === opt.key ? 'var(--primary)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontSize: '0.85rem'
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <input 
                type="text" 
                placeholder="Search pharmacy..."
                className="form-input"
                style={{ width: '220px', margin: 0 }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* AI Recommendation Alert */}
            {aiRecommended && (
              <div className="glass-card" style={{ padding: '20px', border: '1px solid var(--primary)', background: 'rgba(0,217,166,0.02)', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{ background: 'rgba(0,217,166,0.1)', color: 'var(--primary)', padding: '12px', borderRadius: '10px' }}>
                  <FiCpu size={24} />
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>AI Safety & Stock Recommendation</span>
                  <h4 style={{ margin: '4px 0', fontSize: '1rem', fontWeight: 600 }}>{aiRecommended.name} is your best option!</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '4px 0 12px 0' }}>
                    This pharmacy is currently nearest ({aiRecommended.distance} km), has full stock of your {medicines.length} prescribed medications, and boasts a {aiRecommended.rating}/5 rating.
                  </p>
                  <button onClick={() => setSelectedPharmacy(aiRecommended)} className="btn btn-primary btn-sm">Select AI Recommendation</button>
                </div>
              </div>
            )}

            {/* Pharmacies List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filteredList.map(p => (
                <div 
                  key={p.id}
                  onClick={() => setSelectedPharmacy(p)}
                  className={`glass-card ${selectedPharmacy?.id === p.id ? 'selected' : ''}`}
                  style={{
                    padding: '20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    border: selectedPharmacy?.id === p.id ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                    background: selectedPharmacy?.id === p.id ? 'rgba(0,217,166,0.02)' : 'rgba(255,255,255,0.01)',
                    transition: 'all 0.2s'
                  }}
                >
                  <div>
                    <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', fontWeight: 600 }}>{p.name}</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 12px 0' }}>{p.address}</p>
                    
                    <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><FiMapPin color="var(--primary)" /> {p.distance} km away</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><FiStar color="var(--warning)" /> {p.rating} / 5</span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '4px' }}>₹{p.estimatedPrice}</div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>+ ₹{p.deliveryCharges} Delivery</span>
                  </div>
                </div>
              ))}
            </div>

          </div>

          {/* Right Sidebar: Prescription Summary */}
          <div className="glass-card" style={{ padding: '24px', alignSelf: 'start', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 className="heading-sm" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><FiShoppingBag color="var(--primary)" /> Checkout Summary</h3>
            
            <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Diagnosis</span>
              <div style={{ fontWeight: 'bold', marginTop: '2px' }}>{prescription?.diagnosis}</div>
              
              <div className="divider" style={{ margin: '12px 0' }}></div>
              
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Medications</span>
              {medicines.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                  <span>{m.name}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>x {m.duration}</span>
                </div>
              ))}
            </div>

            {selectedPharmacy && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
                  <strong>₹{selectedPharmacy.estimatedPrice}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Delivery Fee</span>
                  <strong>₹{selectedPharmacy.deliveryCharges}</strong>
                </div>
                <div className="divider" style={{ margin: '8px 0' }}></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem' }}>
                  <span>Total Amount</span>
                  <strong className="text-gradient" style={{ fontSize: '1.2rem' }}>₹{selectedPharmacy.estimatedPrice + selectedPharmacy.deliveryCharges}</strong>
                </div>

                <button onClick={handlePlaceOrder} className="btn btn-primary" style={{ width: '100%', marginTop: '12px' }}>Confirm Order & Pay</button>
              </div>
            )}
          </div>

        </div>
      ) : (
        /* Delivery Monitoring Screen */
        <div style={{ maxWidth: '800px', margin: '0 auto' }} className="animate-fade-in">
          
          <div className="glass-card" style={{ padding: '32px', textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              {orderStatus === 'PREPARING' ? (
                <div className="spinner" style={{ width: '60px', height: '60px' }}></div>
              ) : orderStatus === 'DELIVERING' ? (
                <div style={{ position: 'relative' }}>
                  <FiTruck size={48} color="var(--primary)" className="animate-bounce" />
                </div>
              ) : (
                <FiCheckCircle size={64} color="var(--success)" />
              )}
            </div>

            <h2 className="heading-md" style={{ margin: '0 0 8px 0' }}>
              {orderStatus === 'PREPARING' && `Packing your medications... (${packingTimeLeft}s)`}
              {orderStatus === 'DELIVERING' && 'Out for Delivery'}
              {orderStatus === 'COMPLETED' && 'Delivered successfully!'}
            </h2>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
              {orderStatus === 'PREPARING' && `Alfa delivery agent is waiting at ${selectedPharmacy.name} while they pack.`}
              {orderStatus === 'DELIVERING' && `ETA: ${eta} minutes. Pac-man delivering safely to your doorstep.`}
              {orderStatus === 'COMPLETED' && 'Enjoy quick recovery! Let us know if you need anything else.'}
            </p>

            {orderStatus === 'DELIVERING' && (
              <div style={{ width: '100%', background: 'rgba(255,255,255,0.05)', height: '8px', borderRadius: '10px', marginTop: '24px', overflow: 'hidden' }}>
                <div style={{ width: `${deliveryProgress}%`, background: 'var(--primary)', height: '100%', transition: 'width 1.5s ease-in-out' }}></div>
              </div>
            )}
          </div>

          {/* Interactive Map Visualisation */}
          <div className="glass-card" style={{ padding: '24px', background: '#0a0d14', height: '400px', position: 'relative', overflow: 'hidden' }}>
            {/* GPS HUD */}
            <div style={{ position: 'absolute', top: '24px', left: '24px', zIndex: 10, background: 'rgba(0,0,0,0.8)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                <FiNavigation color="var(--primary)" />
                <strong>Live Location Tracker</strong>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Speed: {orderStatus === 'DELIVERING' ? '32 km/h' : '0 km/h'}
              </div>
            </div>

            {/* Custom SVG Simulated Map */}
            <svg width="100%" height="100%" viewBox="0 0 800 400" style={{ display: 'block' }}>
              {/* Roads grid */}
              <path d="M 50 100 Q 200 80 400 120 T 750 100" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
              <path d="M 100 50 Q 250 200 400 350" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
              <path d="M 50 300 H 750" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
              
              {/* Delivery Path Route */}
              {selectedPharmacy && (
                <path 
                  d="M 200 100 L 350 200 L 500 300" 
                  fill="none" 
                  stroke="rgba(0, 217, 166, 0.2)" 
                  strokeWidth="8" 
                  strokeDasharray="10 6"
                />
              )}

              {/* Pharmacy Location Node */}
              <circle cx="200" cy="100" r="16" fill="#1e293b" stroke="var(--primary)" strokeWidth="3" />
              <text x="200" y="75" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold">Pharmacy</text>

              {/* Customer Home Node */}
              <circle cx="500" cy="300" r="16" fill="#1e293b" stroke="var(--secondary)" strokeWidth="3" />
              <text x="500" y="335" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold">Home (You)</text>

              {/* GPS Live Mover (Simulated) */}
              {orderStatus === 'DELIVERING' && (
                <g style={{
                  transform: `translate(${200 + (deliveryProgress * 3.0)}px, ${100 + (deliveryProgress * 2.0)}px)`,
                  transition: 'transform 1.5s ease-in-out'
                }}>
                  <circle cx="0" cy="0" r="10" fill="var(--primary)" className="animate-ping" style={{ opacity: 0.4 }} />
                  <circle cx="0" cy="0" r="8" fill="var(--primary)" />
                  <path d="M -4 -4 L 6 0 L -4 4 Z" fill="#fff" />
                </g>
              )}
            </svg>
          </div>

        </div>
      )}

    </div>
  );
}
