import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { prescriptionAPI, labAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { FiArrowLeft, FiActivity, FiTruck, FiMapPin, FiStar, FiFilter, FiCpu, FiNavigation, FiCheckCircle } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

export default function DiagnosticOrderFlow() {
  const { prescriptionId } = useParams();
  const navigate = useNavigate();
  const [prescription, setPrescription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [labs, setLabs] = useState([]);
  const [selectedLab, setSelectedLab] = useState(null);
  const [bookingPlaced, setBookingPlaced] = useState(false);
  const [bookingStatus, setBookingStatus] = useState('PENDING'); // PENDING, CONFIRMED, SAMPLE_COLLECTED, REPORT_GENERATED, COMPLETED
  const [collectionProgress, setCollectionProgress] = useState(0); // 0 to 100
  const [eta, setEta] = useState(15); // in minutes
  const [collectTimeLeft, setCollectTimeLeft] = useState(30); // countdown in seconds

  // Filters
  const [sortBy, setSortBy] = useState('distance'); // distance, rating
  const [searchQuery, setSearchQuery] = useState('');
  
  useEffect(() => {
    fetchDetails();
  }, [prescriptionId]);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      const [prescRes, labRes] = await Promise.all([
        prescriptionAPI.getById(prescriptionId),
        labAPI.getAll()
      ]);
      setPrescription(prescRes.data);
      
      // Enhance mock labs list with distance, rating
      const enhancedLabs = (labRes.data || []).map((l, idx) => ({
        ...l,
        distance: idx === 0 ? 1.5 : idx === 1 ? 2.8 : 4.2 + idx, // km
        rating: idx === 0 ? 4.8 : idx === 1 ? 4.7 : 4.4,
        estimatedPrice: 350 + (idx * 50), // INR base test cost
        collectionCharges: idx === 0 ? 50 : 0,
      }));

      // If no labs are loaded, populate some demo ones
      if (enhancedLabs.length === 0) {
        setLabs([
          { id: 1, name: 'Alfa Diagnostic Lab', address: 'Colaba, Mumbai', rating: 4.8, distance: 1.5, estimatedPrice: 350, collectionCharges: 50 },
          { id: 2, name: 'Metropolis Healthcare', address: 'Bandra, Mumbai', rating: 4.7, distance: 2.8, estimatedPrice: 400, collectionCharges: 0 },
          { id: 3, name: 'Thyrocare Labs', address: 'Andheri, Mumbai', rating: 4.4, distance: 4.5, estimatedPrice: 300, collectionCharges: 60 }
        ]);
      } else {
        setLabs(enhancedLabs);
      }
    } catch (e) {
      toast.error('Failed to load details');
    } finally {
      setLoading(false);
    }
  };

  // Sort and filter labs
  const getFilteredLabs = () => {
    let result = [...labs];
    if (searchQuery) {
      result = result.filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    
    if (sortBy === 'distance') {
      result.sort((a, b) => a.distance - b.distance);
    } else if (sortBy === 'rating') {
      result.sort((a, b) => b.rating - a.rating);
    }
    return result;
  };

  // AI Recommendation Logic for Lab
  const getAiRecommendation = () => {
    const candidates = [...labs];
    if (candidates.length === 0) return null;
    
    candidates.sort((a, b) => {
      const scoreA = (a.rating * 10) - (a.distance * 2) - (a.estimatedPrice / 100);
      const scoreB = (b.rating * 10) - (b.distance * 2) - (b.estimatedPrice / 100);
      return scoreB - scoreA;
    });

    return candidates[0];
  };

  const [placedBookingId, setPlacedBookingId] = useState(null);

  const handlePlaceBooking = async () => {
    if (!selectedLab) {
      toast.error('Please select a diagnostic lab first.');
      return;
    }
    
    try {
      const subtotal = selectedLab.estimatedPrice;
      const collection = selectedLab.collectionCharges || 0;
      const payload = {
        labName: selectedLab.name,
        testsJson: prescription?.tests || '[]',
        deliveryAddress: prescription?.deliveryAddress || selectedLab.address || 'Default Address',
        testAmount: subtotal,
        collectionCharges: collection,
        totalAmount: subtotal + collection,
        prescriptionId: prescriptionId ? parseInt(prescriptionId) : null
      };
      
      const res = await labAPI.createBooking(payload);
      const bookingId = res?.data?.data?.id;
      setPlacedBookingId(bookingId);

      setBookingPlaced(true);
      setCollectTimeLeft(30);
      const calcEta = 15 + Math.round(selectedLab.distance * 5);
      setEta(calcEta);

      toast.success(`Booking confirmed with ${selectedLab.name}! Agent assignment in progress.`);
    } catch (e) {
      toast.error('Failed to place booking. Please try again.');
    }
  };

  // Real-time backend polling for booking status changes
  useEffect(() => {
    if (!bookingPlaced || !placedBookingId) return;
    if (bookingStatus === 'COMPLETED') return;

    const poll = setInterval(async () => {
      try {
        const res = await labAPI.getPatientBookings();
        const bookings = res.data || [];
        const current = bookings.find(b => b.id === placedBookingId);
        if (!current) return;

        const backendStatus = current.status;

        if (backendStatus === 'CONFIRMED' && bookingStatus === 'PENDING') {
          setBookingStatus('CONFIRMED');
          toast.success('🩺 Sample collection agent dispatched!', { duration: 5000 });
        }
        if (backendStatus === 'SAMPLE_COLLECTED' && bookingStatus !== 'SAMPLE_COLLECTED' && bookingStatus !== 'REPORT_GENERATED' && bookingStatus !== 'COMPLETED') {
          setBookingStatus('SAMPLE_COLLECTED');
          toast.success('🔬 Sample collected successfully! Processing started in lab.', { duration: 5000 });
        }
        if (backendStatus === 'REPORT_GENERATED' && bookingStatus !== 'REPORT_GENERATED' && bookingStatus !== 'COMPLETED') {
          setBookingStatus('REPORT_GENERATED');
          toast.success('📝 Report generated by diagnostics lab!', { duration: 5000 });
        }
        if (backendStatus === 'COMPLETED' && bookingStatus !== 'COMPLETED') {
          setBookingStatus('COMPLETED');
          setCollectionProgress(100);
          toast.success('✅ Diagnostics reports are ready & uploaded!', { duration: 6000 });
          clearInterval(poll);
        }
      } catch (_) {}
    }, 5000);

    return () => clearInterval(poll);
  }, [bookingPlaced, placedBookingId, bookingStatus]);

  // Visual progress animation
  useEffect(() => {
    if (bookingStatus !== 'CONFIRMED') return;
    const timer = setInterval(() => {
      setCollectionProgress(prev => {
        if (prev >= 95) { clearInterval(timer); return 95; }
        if (prev % 20 === 0 && prev > 0) setEta(e => Math.max(1, e - 2));
        return prev + 4;
      });
    }, 1500);
    return () => clearInterval(timer);
  }, [bookingStatus]);

  // General simulation of status changes if no backend interaction overrides
  useEffect(() => {
    if (!bookingPlaced) return;
    const timeout1 = setTimeout(() => {
      if (bookingStatus === 'PENDING') {
        setBookingStatus('CONFIRMED');
        labAPI.updateBookingStatus(placedBookingId, 'CONFIRMED').catch(() => {});
      }
    }, 8000);

    const timeout2 = setTimeout(() => {
      if (bookingStatus === 'CONFIRMED' || bookingStatus === 'PENDING') {
        setBookingStatus('SAMPLE_COLLECTED');
        labAPI.updateBookingStatus(placedBookingId, 'SAMPLE_COLLECTED').catch(() => {});
      }
    }, 25000);

    return () => {
      clearTimeout(timeout1);
      clearTimeout(timeout2);
    };
  }, [bookingPlaced, placedBookingId, bookingStatus]);

  const parseJson = (str) => {
    try {
      if (typeof str === 'object') return str;
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
  const filteredList = getFilteredLabs();
  const tests = prescription ? parseJson(prescription.tests) : [];

  return (
    <div className="page-container section" style={{ minHeight: '85vh' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
        <button onClick={() => navigate('/my-prescriptions')} className="btn btn-ghost btn-icon">
          <FiArrowLeft />
        </button>
        <div>
          <h1 className="heading-md" style={{ margin: 0 }}>Book Diagnostics</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>Select a nearby diagnostic laboratory for home sample collection.</p>
        </div>
      </div>

      {!bookingPlaced ? (
        <div className="diagnostic-order-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '32px' }}>
          
          {/* Main Lab selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Filters panel */}
            <div className="glass-card" style={{ padding: '20px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <FiFilter color="var(--primary)" />
                <strong>Filter & Sort</strong>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[
                    { key: 'distance', label: 'Nearest' },
                    { key: 'rating', label: 'Top Rated' }
                  ].map(opt => (
                    <button 
                      key={opt.key}
                      onClick={() => setSortBy(opt.key)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '20px',
                        background: sortBy === opt.key ? 'rgba(236, 72, 153, 0.1)' : 'transparent',
                        border: sortBy === opt.key ? '1px solid #ec4899' : '1px solid var(--border-color)',
                        color: sortBy === opt.key ? '#ec4899' : 'var(--text-secondary)',
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
                placeholder="Search laboratory..."
                className="form-input"
                style={{ width: '220px', margin: 0 }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* AI Recommendation Alert */}
            {aiRecommended && (
              <div className="glass-card" style={{ padding: '20px', border: '1px solid #ec4899', background: 'rgba(236,72,153,0.02)', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{ background: 'rgba(236,72,153,0.1)', color: '#ec4899', padding: '12px', borderRadius: '10px' }}>
                  <FiCpu size={24} />
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '0.75rem', color: '#ec4899', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>AI Recommended Testing Facility</span>
                  <h4 style={{ margin: '4px 0', fontSize: '1rem', fontWeight: 600 }}>{aiRecommended.name} is recommended!</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '4px 0 12px 0' }}>
                    Nearest certified lab center ({aiRecommended.distance} km away) with {aiRecommended.rating}/5 rating and prompt home sample collection capability.
                  </p>
                  <button onClick={() => setSelectedLab(aiRecommended)} className="btn btn-primary btn-sm" style={{ background: '#ec4899', border: 'none' }}>Select AI Recommendation</button>
                </div>
              </div>
            )}

            {/* Labs List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filteredList.map(l => (
                <div 
                  key={l.id}
                  onClick={() => setSelectedLab(l)}
                  className={`glass-card ${selectedLab?.id === l.id ? 'selected' : ''}`}
                  style={{
                    padding: '20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    border: selectedLab?.id === l.id ? '2px solid #ec4899' : '1px solid var(--border-color)',
                    background: selectedLab?.id === l.id ? 'rgba(236,72,153,0.02)' : 'rgba(255,255,255,0.01)',
                    transition: 'all 0.2s'
                  }}
                >
                  <div>
                    <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', fontWeight: 600 }}>{l.name}</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 12px 0' }}>{l.address}</p>
                    
                    <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><FiMapPin color="#ec4899" /> {l.distance} km away</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><FiStar color="var(--warning)" /> {l.rating} / 5</span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '4px' }}>₹{l.estimatedPrice}</div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>+ ₹{l.collectionCharges} home collection</span>
                  </div>
                </div>
              ))}
            </div>

          </div>

          {/* Right Sidebar: Prescription Summary */}
          <div className="glass-card" style={{ padding: '24px', alignSelf: 'start', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 className="heading-sm" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><FiActivity color="#ec4899" /> Booking Summary</h3>
            
            <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Diagnosis</span>
              <div style={{ fontWeight: 'bold', marginTop: '2px' }}>{prescription?.diagnosis}</div>
              
              <div className="divider" style={{ margin: '12px 0' }}></div>
              
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Prescribed Tests</span>
              {tests.map((t, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', fontSize: '0.85rem', marginBottom: '8px' }}>
                  <span style={{ fontWeight: '600' }}>• {t.testName || t}</span>
                  {t.reason && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '10px' }}>{t.reason}</span>}
                </div>
              ))}
            </div>

            {selectedLab && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Tests Base Cost</span>
                  <strong>₹{selectedLab.estimatedPrice}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Home Collection Fee</span>
                  <strong>₹{selectedLab.collectionCharges}</strong>
                </div>
                <div className="divider" style={{ margin: '8px 0' }}></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem' }}>
                  <span>Total Amount</span>
                  <strong style={{ fontSize: '1.2rem', color: '#ec4899' }}>₹{selectedLab.estimatedPrice + selectedLab.collectionCharges}</strong>
                </div>

                <button onClick={handlePlaceBooking} className="btn btn-primary" style={{ width: '100%', marginTop: '12px', background: '#ec4899', border: 'none' }}>Confirm Booking & Pay</button>
              </div>
            )}
          </div>

        </div>
      ) : (
        /* Collection Monitoring Screen */
        <div style={{ maxWidth: '800px', margin: '0 auto' }} className="animate-fade-in">
          
          <div className="glass-card" style={{ padding: '32px', textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              {bookingStatus === 'PENDING' ? (
                <div className="spinner" style={{ width: '60px', height: '60px' }}></div>
              ) : bookingStatus === 'CONFIRMED' || bookingStatus === 'SAMPLE_COLLECTED' || bookingStatus === 'REPORT_GENERATED' ? (
                <div style={{ position: 'relative' }}>
                  <FiTruck size={48} color="#ec4899" className="animate-bounce" />
                </div>
              ) : (
                <FiCheckCircle size={64} color="var(--success)" />
              )}
            </div>

            <h2 className="heading-md" style={{ margin: '0 0 8px 0' }}>
              {bookingStatus === 'PENDING' && `Assigning sample collection agent...`}
              {bookingStatus === 'CONFIRMED' && `Agent Dispatched (ETA: ${eta} mins)`}
              {bookingStatus === 'SAMPLE_COLLECTED' && 'Sample Processing in Laboratory'}
              {bookingStatus === 'REPORT_GENERATED' && 'Analyzing Diagnostics Data'}
              {bookingStatus === 'COMPLETED' && 'Diagnostic Report Uploaded!'}
            </h2>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
              {bookingStatus === 'PENDING' && `Contacting closest health workers at ${selectedLab.name}.`}
              {bookingStatus === 'CONFIRMED' && `Sample collection officer is on the way to your address: ${prescription?.deliveryAddress || 'Default Address'}`}
              {bookingStatus === 'SAMPLE_COLLECTED' && `Your blood/sample has been checked in at ${selectedLab.name}. Results will be generated shortly.`}
              {bookingStatus === 'REPORT_GENERATED' && 'Pathologist is reviewing the results for digital verification.'}
              {bookingStatus === 'COMPLETED' && 'Your medical files are ready. Check My Prescriptions to view reports.'}
            </p>

            {bookingStatus === 'CONFIRMED' && (
              <div style={{ width: '100%', background: 'rgba(255,255,255,0.05)', height: '8px', borderRadius: '10px', marginTop: '24px', overflow: 'hidden' }}>
                <div style={{ width: `${collectionProgress}%`, background: '#ec4899', height: '100%', transition: 'width 1.5s ease-in-out' }}></div>
              </div>
            )}
          </div>

          {/* Interactive Map Visualisation */}
          <div className="glass-card" style={{ padding: '24px', background: '#0a0d14', height: '400px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '24px', left: '24px', zIndex: 10, background: 'rgba(0,0,0,0.8)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                <FiNavigation color="#ec4899" />
                <strong>Agent Live GPS</strong>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Status: {bookingStatus}
              </div>
            </div>

            <svg width="100%" height="100%" viewBox="0 0 800 400" style={{ display: 'block' }}>
              <path d="M 50 120 Q 220 70 380 140 T 750 90" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
              <path d="M 120 40 Q 280 220 380 340" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
              <path d="M 40 320 H 760" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
              
              {selectedLab && (
                <path 
                  d="M 180 120 L 330 200 L 520 280" 
                  fill="none" 
                  stroke="rgba(236, 72, 153, 0.2)" 
                  strokeWidth="8" 
                  strokeDasharray="10 6"
                />
              )}

              {/* Lab Location Node */}
              <circle cx="180" cy="120" r="16" fill="#1e293b" stroke="#ec4899" strokeWidth="3" />
              <text x="180" y="95" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold">Diagnostics</text>

              {/* Customer Home Node */}
              <circle cx="520" cy="280" r="16" fill="#1e293b" stroke="var(--secondary)" strokeWidth="3" />
              <text x="520" y="315" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold">Home (You)</text>

              {/* GPS Live Mover */}
              {bookingStatus === 'CONFIRMED' && (
                <g style={{
                  transform: `translate(${180 + (collectionProgress * 3.4)}px, ${120 + (collectionProgress * 1.6)}px)`,
                  transition: 'transform 1.5s ease-in-out'
                }}>
                  <circle cx="0" cy="0" r="10" fill="#ec4899" className="animate-ping" style={{ opacity: 0.4 }} />
                  <circle cx="0" cy="0" r="8" fill="#ec4899" />
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
