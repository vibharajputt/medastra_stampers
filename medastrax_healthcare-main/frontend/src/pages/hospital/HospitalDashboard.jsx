import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { hospitalAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { 
  FiSettings, 
  FiUsers, 
  FiActivity, 
  FiPhone, 
  FiMail, 
  FiMapPin, 
  FiCheck,
  FiMap,
  FiCalendar,
  FiClock,
  FiShield
} from 'react-icons/fi';
import { FaHospital, FaUserMd } from 'react-icons/fa';
import { motion } from 'framer-motion';

export default function HospitalDashboard() {
  const { user } = useAuth();
  const [hospital, setHospital] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [updatingBeds, setUpdatingBeds] = useState(false);
  const [availableBedsInput, setAvailableBedsInput] = useState(0);

  useEffect(() => {
    if (user.hospitalId) {
      fetchHospitalData();
    } else {
      setLoading(false);
      setLoadingDoctors(false);
    }
  }, [user.hospitalId]);

  const fetchHospitalData = async () => {
    try {
      setLoading(true);
      const res = await hospitalAPI.getById(user.hospitalId);
      setHospital(res.data);
      setAvailableBedsInput(res.data.availableBeds);
      
      // Fetch associated doctors
      fetchDoctors(res.data.id);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load hospital profile data');
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctors = async (hospitalId) => {
    try {
      setLoadingDoctors(true);
      const res = await hospitalAPI.getDoctors(hospitalId);
      setDoctors(res.data);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load registered doctors');
    } finally {
      setLoadingDoctors(false);
    }
  };

  const handleUpdateBeds = async (e) => {
    e.preventDefault();
    if (!hospital) return;

    if (availableBedsInput < 0 || availableBedsInput > hospital.totalBeds) {
      toast.error(`Available beds must be between 0 and ${hospital.totalBeds}`);
      return;
    }

    try {
      setUpdatingBeds(true);
      const loadToast = toast.loading('Updating bed availability...');
      await hospitalAPI.updateBeds(hospital.id, availableBedsInput);
      toast.success('Bed availability updated successfully! 🛏️', { id: loadToast });
      setHospital(prev => ({ ...prev, availableBeds: availableBedsInput }));
    } catch (error) {
      toast.error('Failed to update bed details');
    } finally {
      setUpdatingBeds(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container flex-center" style={{ height: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ width: '40px', height: '40px', borderColor: 'var(--primary)', borderTopColor: 'transparent' }}></div>
      </div>
    );
  }

  if (!user.hospitalId || !hospital) {
    return (
      <div className="page-container section">
        <div className="empty-state glass-card">
          <FaHospital className="icon" style={{ fontSize: '4rem', color: 'var(--primary)' }} />
          <h3>No Registered Hospital Profile</h3>
          <p>Please register your hospital first or contact system administrator.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container section">
      
      {/* Welcome Banner */}
      <div className="dashboard-header animate-slide-up" style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h1 className="heading-lg" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="text-gradient">{hospital.name}</span>
            <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>Verified ✓</span>
          </h1>
          <p className="auth-subtitle" style={{ marginTop: '8px' }}>Manage hospital listings, beds availability, and view associated doctors.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ textSelf: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Registration No: <strong>{hospital.registrationNo || 'N/A'}</strong>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-3 animate-fade-in" style={{ marginBottom: '40px' }}>
        <div className="glass-card stat-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="stat-value text-gradient" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiActivity style={{ strokeWidth: 2.5 }} /> {hospital.availableBeds} / {hospital.totalBeds}
          </div>
          <div className="stat-label" style={{ marginTop: '6px' }}>Beds Available</div>
        </div>
        
        <div className="glass-card stat-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="stat-value text-gradient" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FaUserMd /> {doctors.length}
          </div>
          <div className="stat-label" style={{ marginTop: '6px' }}>Registered Doctors</div>
        </div>

        <div className="glass-card stat-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="stat-value text-gradient" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            ⭐ {hospital.rating || '4.5'}
          </div>
          <div className="stat-label" style={{ marginTop: '6px' }}>Hospital Rating</div>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid hospital-dashboard-grid animate-slide-up" style={{ gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
        
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Quick Bed Update Form */}
          <div className="glass-card" style={{ padding: '28px' }}>
            <h3 className="heading-sm" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FiActivity color="var(--primary)" /> Manage Bed Availability
            </h3>
            
            <form onSubmit={handleUpdateBeds} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '200px' }}>
                <label className="form-label">Available Beds (Currently unoccupied)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input 
                    type="range" 
                    min="0" 
                    max={hospital.totalBeds} 
                    value={availableBedsInput} 
                    onChange={(e) => setAvailableBedsInput(parseInt(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--primary)' }}
                  />
                  <input 
                    type="number" 
                    className="form-input" 
                    style={{ width: '100px', padding: '10px' }} 
                    min="0" 
                    max={hospital.totalBeds}
                    value={availableBedsInput}
                    onChange={(e) => setAvailableBedsInput(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ height: '48px', padding: '0 32px' }}
                disabled={updatingBeds || availableBedsInput === hospital.availableBeds}
              >
                Save bed count
              </button>
            </form>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '12px' }}>
              Updating availability helps emergency services and patients find real-time vacant beds. Total bed capacity is configured as <strong>{hospital.totalBeds}</strong>.
            </p>
          </div>

          {/* Specialties and Facilities Lists */}
          <div className="glass-card" style={{ padding: '28px' }}>
            <h3 className="heading-sm" style={{ marginBottom: '24px' }}>Departments & Facilities</h3>
            
            <div className="grid grid-2" style={{ gap: '24px' }}>
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  🏥 Specialities & Departments
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {hospital.doctorTypes && hospital.doctorTypes.length > 0 ? (
                    hospital.doctorTypes.map((spec, i) => (
                      <span key={i} className="badge badge-primary" style={{ textTransform: 'none', padding: '6px 12px' }}>{spec}</span>
                    ))
                  ) : (
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No specialities registered</span>
                  )}
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  🌟 Hospital Facilities
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {hospital.facilities && hospital.facilities.length > 0 ? (
                    hospital.facilities.map((fac, i) => (
                      <span key={i} className="badge badge-secondary" style={{ textTransform: 'none', padding: '6px 12px' }}>{fac}</span>
                    ))
                  ) : (
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No facilities registered</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* List of Registered Doctors */}
          <div className="glass-card" style={{ padding: '28px' }}>
            <h3 className="heading-sm" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FiUsers color="var(--primary)" /> Registered Doctors ({doctors.length})
            </h3>

            {loadingDoctors ? (
              <div style={{ padding: '20px 0', textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto', width: '30px', height: '30px' }}></div>
              </div>
            ) : doctors.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                <FaUserMd style={{ fontSize: '2.5rem', opacity: 0.3, marginBottom: '12px' }} />
                <p style={{ fontWeight: 500, fontSize: '0.95rem' }}>No Doctors Associated Yet</p>
                <p style={{ fontSize: '0.8rem', marginTop: '4px', maxWidth: '400px', margin: '4px auto 0' }}>
                  When doctors register on MedAstraX, they select their associated hospital. Once they select your hospital, they will automatically appear in this list.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {doctors.map((doc) => (
                  <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div className="avatar avatar-lg">
                        {doc.avatarUrl ? (
                          <img src={doc.avatarUrl} alt={doc.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          doc.name.charAt(0)
                        )}
                      </div>
                      <div>
                        <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{doc.name}</h4>
                        <div style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 500, marginTop: '2px' }}>{doc.specialization}</div>
                        <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <FiPhone size={12} /> {doc.phone || 'No phone'}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <FiMail size={12} /> {doc.email}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', minWidth: '150px' }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>₹{doc.fees} / session</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: 'var(--text-secondary)', justifyContent: 'flex-end', marginTop: '4px' }}>
                        <FiClock size={12} /> {doc.workingHours}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {doc.workingDays ? doc.workingDays.split(',').join(' • ') : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Hospital Photo */}
          <div className="glass-card" style={{ padding: '20px', textAlign: 'center' }}>
            <div style={{ 
              width: '100%', 
              height: '180px', 
              borderRadius: 'var(--radius-md)', 
              background: `url(${hospital.images?.[0] || 'https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=800'}) center/cover`,
              marginBottom: '16px'
            }}></div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Main Building Photo</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Displayed to patients in search listings.</p>
          </div>

          {/* Contact and Location Card */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <h3 className="heading-sm" style={{ marginBottom: '20px', fontSize: '1.1rem' }}>Location & Contact</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <FiMapPin color="var(--primary)" style={{ marginTop: '4px', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Street Address</div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginTop: '2px' }}>{hospital.address}</div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginTop: '2px', fontWeight: 600 }}>
                    {hospital.city}, {hospital.state} - {hospital.pincode}
                  </div>
                </div>
              </div>

              {hospital.latitude && hospital.longitude && (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <FiMap color="var(--primary)" style={{ marginTop: '4px', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>GPS Coordinates</div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginTop: '2px' }}>
                      Lat: {hospital.latitude.toFixed(6)}
                    </div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      Long: {hospital.longitude.toFixed(6)}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <FiPhone color="var(--primary)" style={{ marginTop: '4px', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Contact Phone</div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginTop: '2px' }}>{hospital.phone}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <FiMail color="var(--primary)" style={{ marginTop: '4px', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Official Email</div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginTop: '2px' }}>{hospital.email}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Guide Card */}
          <div className="glass-card" style={{ padding: '24px', background: 'rgba(29, 158, 117, 0.03)', borderColor: 'var(--primary-light)' }}>
            <h3 className="heading-sm" style={{ marginBottom: '12px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FiShield color="var(--primary)" /> Verification Status
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Your hospital registration profile is active and verified. Any doctor signing up on MedAstraX can select your hospital to create their schedules. 
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px', fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>
              <FiCheck /> Real-time search listed
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
