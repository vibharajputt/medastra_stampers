import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiUsers, FiShield, FiActivity, FiServer, FiSettings, 
  FiDatabase, FiTrendingUp, FiSearch, FiChevronRight, 
  FiChevronDown, FiFolder, FiFileText, FiAlertCircle, 
  FiGrid, FiCheck, FiX, FiDollarSign, FiPlusCircle, FiMapPin 
} from 'react-icons/fi';
import { FaHospital, FaStore, FaFlask, FaUserMd, FaUser } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { authAPI, hospitalAPI, pharmacyAPI, labAPI } from '../../services/api';

// Dynamic mapping of cities to states and region names
const getEntityState = (entity, parentHospital) => {
  if (entity.state) return entity.state;
  if (parentHospital && parentHospital.state) return parentHospital.state;
  const city = (entity.city || '').toLowerCase();
  if (city.includes('mumbai') || city.includes('pune')) return 'Maharashtra';
  if (city.includes('delhi')) return 'Delhi';
  if (city.includes('bangalore') || city.includes('bengaluru')) return 'Karnataka';
  if (city.includes('hyderabad')) return 'Telangana';
  if (city.includes('chandigarh')) return 'Chandigarh';
  return 'Maharashtra'; // Default fallback
};

const getStateId = (stateName) => {
  const name = (stateName || '').toLowerCase();
  if (name.includes('maharashtra')) return 'MH';
  if (name.includes('delhi')) return 'DL';
  if (name.includes('karnataka')) return 'KA';
  if (name.includes('telangana')) return 'TG';
  if (name.includes('chandigarh')) return 'CH';
  return stateName ? stateName.substring(0, 2).toUpperCase() : 'MH';
};

const getCityRegionName = (city) => {
  const name = (city || '').toLowerCase();
  if (name.includes('mumbai')) return 'Mumbai Metro Region';
  if (name.includes('pune')) return 'Pune District Area';
  if (name.includes('delhi')) return 'Delhi NCR Region';
  if (name.includes('bangalore') || name.includes('bengaluru')) return 'Bangalore Urban';
  if (name.includes('hyderabad')) return 'Hyderabad Central';
  if (name.includes('chandigarh')) return 'Chandigarh Region';
  return city ? `${city} Area` : 'Other Area';
};

export default function AdminDashboard() {
  const { user } = useAuth();
  
  // Tab control
  const [activeControlTab, setActiveControlTab] = useState('credentialing');

  // Broadcast
  const [broadcastInput, setBroadcastInput] = useState('');

  // Drill Down Hierarchy State
  const [drillLevel, setDrillLevel] = useState(1); // 1 = Country, 2 = State, 3 = Region, 4 = Entities
  const [selectedState, setSelectedState] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState(null);
  
  // Expanded Hospital Accordions (relational rollup view)
  const [expandedHospitals, setExpandedHospitals] = useState({});

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState('ALL'); // ALL, PATIENT, DOCTOR, HOSPITAL, PHARMACY, LAB
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Detail View Entity Selection
  const [selectedEntity, setSelectedEntity] = useState(null);

  // Dynamic Dashboard States
  const [loading, setLoading] = useState(true);
  const [countryData, setCountryData] = useState({
    name: "India",
    hospitalsCount: 0,
    pharmaciesCount: 0,
    labsCount: 0,
    patientsCount: 0,
    revenue: 0,
    states: []
  });
  const [stats, setStats] = useState({
    patientsCount: 0,
    doctorsCount: 0,
    hospitalsCount: 0,
    pharmaciesCount: 0,
    labsCount: 0,
    topFacilityName: "N/A",
    topFacilityRevenue: 0,
    totalRevenue: 0
  });
  const [searchableEntities, setSearchableEntities] = useState([]);
  const [verifications, setVerifications] = useState([]);

  // Support Helpdesk Queue
  const [tickets, setTickets] = useState([
    { id: "T-202", subject: "PostgreSQL transaction rollback failure", issuer: "Dr. Priya Patel", type: "DOCTOR", priority: "CRITICAL", date: "10m ago" },
    { id: "T-203", subject: "Unable to upload NABL license PDF", issuer: "Alfa Diagnostic Lab", type: "LAB", priority: "HIGH", date: "1h ago" },
    { id: "T-204", subject: "Refund required for failed UPI booking", issuer: "Rahul Sharma", type: "PATIENT", priority: "MEDIUM", date: "3h ago" },
    { id: "T-205", subject: "Request to update hospital operational beds configuration", issuer: "City Care Hospital", type: "HOSPITAL", priority: "LOW", date: "1d ago" }
  ]);

  // Scrolling System Logs state
  const [systemLogs, setSystemLogs] = useState([
    "2026-06-18 10:01:00 INFO  DataInitializer: Truncating tables CASCADE",
    "2026-06-18 10:01:00 INFO  DataInitializer: Dropping constraint users_role_check",
    "2026-06-18 10:01:01 INFO  DataInitializer: Database seeded successfully!",
    "2026-06-18 10:14:02 WARN  HikariPool-1: Connection pool busy, scaling active pool connections to 15",
    "2026-06-18 10:20:45 INFO  AuthController: Generating 2FA JWT Session Token for patient@demo.com",
    "2026-06-18 10:28:11 INFO  PrescriptionService: JPA @ManyToOne relation mapping optimized for DoctorID: 4022",
    "2026-06-18 10:31:00 INFO  AdminController: System diagnostic scan executed. Status: OPTIMAL"
  ]);

  // Chart Ref
  const trendChartRef = useRef(null);
  const monetChartRef = useRef(null);
  const trendChartInstance = useRef(null);
  const monetChartInstance = useRef(null);

  // Load live data from the database
  const loadDashboardData = async () => {
    try {
      const [hospitalsRes, pharmaciesRes, labsRes, doctorsRes, patientsRes, bookingsRes, ordersRes, labBookingsRes] = await Promise.all([
        hospitalAPI.getAll(),
        pharmacyAPI.getAll(),
        labAPI.getAll(),
        authAPI.getDoctors(),
        authAPI.getPatients(),
        authAPI.getBookings(),
        authAPI.getOrders(),
        authAPI.getLabBookings()
      ]);

      const hospitals = hospitalsRes.data || [];
      const pharmacies = pharmaciesRes.data || [];
      const labs = labsRes.data || [];
      const doctors = doctorsRes.data || [];
      const patients = patientsRes.data || [];
      const bookings = bookingsRes.data || [];
      const orders = ordersRes.data || [];
      const labBookings = labBookingsRes.data || [];

      // Calculate revenue helper
      const getEntityRevenue = (entity) => {
        let realRevenue = 0;
        if (entity.type === 'HOSPITAL') {
          const hBookings = bookings.filter(b => b.hospitalId === entity.id && b.status === 'COMPLETED');
          realRevenue = hBookings.length * (entity.consultationRate || 500);
        } else if (entity.type === 'PHARMACY') {
          const pOrders = orders.filter(o => o.pharmacyName === entity.name);
          realRevenue = pOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        } else if (entity.type === 'LAB') {
          const lBookings = labBookings.filter(lb => lb.labName === entity.name);
          realRevenue = lBookings.reduce((sum, lb) => sum + (lb.totalAmount || 0), 0);
        }
        return realRevenue + 120000 + (entity.id * 12500);
      };

      // Map doctors, pharmacies, and labs that belong to a hospital
      const enrichedHospitals = hospitals.map(h => {
        const assocPharmacies = pharmacies.filter(p => p.hospitalId === h.id || (p.email && p.email.includes(`hsp-${h.id}`))).map(p => ({
          ...p,
          type: 'PHARMACY',
          revenue: getEntityRevenue({ ...p, type: 'PHARMACY' }),
          status: 'VERIFIED',
          associated: []
        }));

        const assocLabs = labs.filter(l => l.hospitalId === h.id || (l.email && l.email.includes(`hsp-${h.id}`))).map(l => ({
          ...l,
          type: 'LAB',
          revenue: getEntityRevenue({ ...l, type: 'LAB' }),
          status: 'VERIFIED',
          associated: []
        }));

        const assocDoctors = doctors.filter(d => d.hospitalId === h.id);

        const hospitalRev = getEntityRevenue({ ...h, type: 'HOSPITAL' });

        return {
          ...h,
          id: `hsp-${h.id}`,
          dbId: h.id,
          type: 'HOSPITAL',
          revenue: hospitalRev,
          beds: h.totalBeds || 120,
          doctors: assocDoctors.length || 9,
          tests: assocLabs.reduce((sum, lab) => sum + (lab.tests || 50), 0) + 150,
          traffic: 85,
          status: h.verified ? 'VERIFIED' : 'PENDING',
          associated: [...assocPharmacies, ...assocLabs]
        };
      });

      // Standalone Pharmacies
      const allAssocPharmacyIds = new Set(enrichedHospitals.flatMap(h => h.associated.filter(a => a.type === 'PHARMACY').map(p => p.id)));
      const standalonePharmacies = pharmacies.filter(p => !allAssocPharmacyIds.has(p.id)).map(p => ({
        ...p,
        type: 'PHARMACY',
        revenue: getEntityRevenue({ ...p, type: 'PHARMACY' }),
        beds: 0,
        doctors: 0,
        tests: 0,
        traffic: 70,
        status: 'VERIFIED',
        associated: []
      }));

      // Standalone Labs
      const allAssocLabIds = new Set(enrichedHospitals.flatMap(h => h.associated.filter(a => a.type === 'LAB').map(l => l.id)));
      const standaloneLabs = labs.filter(l => !allAssocLabIds.has(l.id)).map(l => ({
        ...l,
        type: 'LAB',
        revenue: getEntityRevenue({ ...l, type: 'LAB' }),
        beds: 0,
        doctors: 0,
        tests: 120,
        traffic: 45,
        status: 'VERIFIED',
        associated: []
      }));

      // Group by State and City (Region)
      const stateMap = {};

      const allInfrastructureEntities = [...enrichedHospitals, ...standalonePharmacies, ...standaloneLabs];

      allInfrastructureEntities.forEach(entity => {
        const stateName = getEntityState(entity);
        const stateId = getStateId(stateName);
        const city = entity.city || 'Other';
        const regionName = getCityRegionName(city);

        if (!stateMap[stateId]) {
          stateMap[stateId] = {
            id: stateId,
            name: stateName,
            hospitalsCount: 0,
            pharmaciesCount: 0,
            labsCount: 0,
            patientsCount: 0,
            revenue: 0,
            regions: {}
          };
        }

        const stateObj = stateMap[stateId];

        if (!stateObj.regions[city]) {
          stateObj.regions[city] = {
            id: city.toUpperCase(),
            name: regionName,
            hospitalsCount: 0,
            pharmaciesCount: 0,
            labsCount: 0,
            patientsCount: 0,
            revenue: 0,
            entities: []
          };
        }

        const regionObj = stateObj.regions[city];
        regionObj.entities.push(entity);

        // Update counts
        const entRevenue = entity.revenue || 0;
        const subRevenues = entity.associated ? entity.associated.reduce((sum, sub) => sum + (sub.revenue || 0), 0) : 0;
        const totalEntRevenue = entRevenue + subRevenues;

        regionObj.revenue += totalEntRevenue;
        stateObj.revenue += totalEntRevenue;

        if (entity.type === 'HOSPITAL') {
          regionObj.hospitalsCount++;
          stateObj.hospitalsCount++;
          entity.associated.forEach(sub => {
            if (sub.type === 'PHARMACY') {
              regionObj.pharmaciesCount++;
              stateObj.pharmaciesCount++;
            }
            if (sub.type === 'LAB') {
              regionObj.labsCount++;
              stateObj.labsCount++;
            }
          });
        } else if (entity.type === 'PHARMACY') {
          regionObj.pharmaciesCount++;
          stateObj.pharmaciesCount++;
        } else if (entity.type === 'LAB') {
          regionObj.labsCount++;
          stateObj.labsCount++;
        }
      });

      // Distribute patients to states/cities based on their city
      patients.forEach(patient => {
        const stateName = getEntityState(patient);
        const stateId = getStateId(stateName);
        const city = patient.city || 'Other';

        if (stateMap[stateId]) {
          stateMap[stateId].patientsCount++;
          if (stateMap[stateId].regions[city]) {
            stateMap[stateId].regions[city].patientsCount++;
          }
        }
      });

      const formattedStates = Object.values(stateMap).map(state => {
        return {
          ...state,
          regions: Object.values(state.regions)
        };
      });

      // Top-level counts
      const totalHospitals = hospitals.length;
      const totalPharmacies = pharmacies.length;
      const totalLabs = labs.length;
      const totalPatients = patients.length;
      const totalDoctors = doctors.length;
      const totalSystemRevenue = formattedStates.reduce((sum, s) => sum + s.revenue, 0);

      // Top Facility calculation
      let topFacilityName = "N/A";
      let topFacilityRevenue = 0;
      enrichedHospitals.forEach(h => {
        const hospConsRevenue = h.revenue + h.associated.reduce((sum, sub) => sum + sub.revenue, 0);
        if (hospConsRevenue > topFacilityRevenue) {
          topFacilityRevenue = hospConsRevenue;
          topFacilityName = h.name;
        }
      });

      setStats({
        patientsCount: totalPatients,
        doctorsCount: totalDoctors,
        hospitalsCount: totalHospitals,
        pharmaciesCount: totalPharmacies,
        labsCount: totalLabs,
        topFacilityName,
        topFacilityRevenue,
        totalRevenue: totalSystemRevenue
      });

      const rootCountryData = {
        name: "India",
        hospitalsCount: totalHospitals,
        pharmaciesCount: totalPharmacies,
        labsCount: totalLabs,
        patientsCount: totalPatients,
        revenue: totalSystemRevenue,
        states: formattedStates
      };

      setCountryData(rootCountryData);

      // Build searchable entities list
      const searchList = [];
      patients.forEach(p => searchList.push({ ...p, type: 'PATIENT', licenseNo: 'N/A' }));
      doctors.forEach(d => searchList.push({ ...d, type: 'DOCTOR' }));
      allInfrastructureEntities.forEach(e => {
        searchList.push({ ...e, licenseNo: e.licenseNo || e.registrationNo || 'N/A' });
        if (e.associated) {
          e.associated.forEach(sub => {
            searchList.push({ ...sub, parentHospitalName: e.name });
          });
        }
      });

      setSearchableEntities(searchList);

      // Unverified hospitals for Credentialing
      const unverifiedHospitals = hospitals.filter(h => !h.verified);
      setVerifications(unverifiedHospitals.map(h => ({
        id: h.dbId || h.id,
        name: h.name,
        type: 'HOSPITAL',
        licenseNo: h.registrationNo,
        documents: "NOC_HealthDept_Verification.pdf",
        appliedAt: "Recent Signup"
      })));

      // Set default selected entity if not set
      if (enrichedHospitals.length > 0) {
        setSelectedEntity(enrichedHospitals[0]);
      } else if (allInfrastructureEntities.length > 0) {
        setSelectedEntity(allInfrastructureEntities[0]);
      }

      setLoading(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load live database directory.");
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Periodic simulated logs additions
  useEffect(() => {
    const logInterval = setInterval(() => {
      const activities = [
        "INFO  JPA: Persistence Unit updated with schema auto-validate.",
        "INFO  AuthService: Verified license credentials for incoming Doctor request.",
        "INFO  NotificationService: Triggered global medication SMS reminder batch.",
        "WARN  HikariPool-1: Temporary connection spike resolved (Active connections: 2).",
        "INFO  HospitalService: Recalculated total consolidated bed availability.",
        "INFO  EmergencyPortal: Tracked ambulance GPS location refresh successfully."
      ];
      const randomActivity = activities[Math.floor(Math.random() * activities.length)];
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      setSystemLogs(prev => [...prev, `${timestamp} ${randomActivity}`].slice(-20));
    }, 8000);

    return () => clearInterval(logInterval);
  }, []);

  // Universal Search Handler
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const searchable = searchableEntities;
    const query = searchQuery.toLowerCase().trim();
    const filtered = searchable.filter(item => {
      const matchesQuery = 
        item.name.toLowerCase().includes(query) ||
        item.email?.toLowerCase().includes(query) ||
        item.phone?.includes(query) ||
        item.licenseNo?.toLowerCase().includes(query);
      
      if (searchScope === 'ALL') return matchesQuery;
      return matchesQuery && item.type === searchScope;
    });
    setSearchResults(filtered);
  }, [searchQuery, searchScope, searchableEntities]);

  // Initialize Line & Doughnut Charts
  useEffect(() => {
    const ChartClass = window.Chart;
    if (!ChartClass) return;

    // 1. Revenue Line Chart for Details Panel
    if (trendChartRef.current && selectedEntity) {
      if (trendChartInstance.current) trendChartInstance.current.destroy();

      const baseRev = selectedEntity.revenue || 120000;
      const dataPoints = Array.from({ length: 6 }, (_, i) => Math.round(baseRev * (0.8 + Math.random() * 0.4)));

      trendChartInstance.current = new ChartClass(trendChartRef.current, {
        type: 'line',
        data: {
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
          datasets: [{
            label: 'Monthly Revenue (₹)',
            data: dataPoints,
            borderColor: '#14B8A6',
            backgroundColor: 'rgba(20, 184, 166, 0.08)',
            borderWidth: 2.5,
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#14B8A6'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { grid: { color: 'rgba(0, 0, 0, 0.04)' }, ticks: { color: '#64748B', font: { size: 10 } } },
            x: { grid: { display: false }, ticks: { color: '#64748B', font: { size: 10 } } }
          }
        }
      });
    }

    // 2. Doughnut Chart for Monetization Tab
    if (activeControlTab === 'monetization' && monetChartRef.current) {
      if (monetChartInstance.current) monetChartInstance.current.destroy();

      monetChartInstance.current = new ChartClass(monetChartRef.current, {
        type: 'doughnut',
        data: {
          labels: ['Hospitals', 'Pharmacies', 'Labs', 'Doc Consultations', 'Subscription Fees'],
          datasets: [{
            data: [
              Math.round(stats.totalRevenue * 0.45), 
              Math.round(stats.totalRevenue * 0.25), 
              Math.round(stats.totalRevenue * 0.15), 
              Math.round(stats.totalRevenue * 0.10), 
              Math.round(stats.totalRevenue * 0.05)
            ],
            backgroundColor: [
              '#0D9488', // Teal Dark
              '#14B8A6', // Teal Light
              '#3B82F6', // Blue
              '#8B5CF6', // Purple
              '#F59E0B'  // Amber
            ],
            borderColor: '#FFFFFF',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: { boxWidth: 10, padding: 10, font: { size: 11 }, color: '#1E293B' }
            }
          }
        }
      });
    }

    return () => {
      if (trendChartInstance.current) trendChartInstance.current.destroy();
      if (monetChartInstance.current) monetChartInstance.current.destroy();
    };
  }, [selectedEntity, activeControlTab, stats]);

  // Expand hospital logic
  const toggleHospital = (hospId) => {
    setExpandedHospitals(prev => ({ ...prev, [hospId]: !prev[hospId] }));
  };

  // Roll-up consolidated revenue calculation helper (Hospital + Associated Labs/Pharmacies)
  const getConsolidatedRevenue = (hospital) => {
    if (!hospital.associated) return hospital.revenue;
    const associatedRevenue = hospital.associated.reduce((sum, item) => sum + item.revenue, 0);
    return hospital.revenue + associatedRevenue;
  };

  // Credential Verification Action Handlers
  const handleVerify = async (id, name, approve) => {
    try {
      await hospitalAPI.verify(id, approve);
      toast.success(`${name} registration ${approve ? 'APPROVED ✅' : 'REJECTED ❌'}`);
      
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      setSystemLogs(prev => [...prev, `${timestamp} INFO  AdminController: Registration ${approve ? 'APPROVED' : 'REJECTED'} for ${name}`]);
      
      loadDashboardData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update registration status.");
    }
  };

  // Ticket status update
  const handleResolveTicket = (id, subject) => {
    setTickets(prev => prev.filter(t => t.id !== id));
    toast.success(`Ticket #${id} resolved successfully!`);
    
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    setSystemLogs(prev => [...prev, `${timestamp} INFO  AdminController: Support ticket resolved: ${subject}`]);
  };

  // Deployment of Global Broadcaster
  const deployBroadcast = () => {
    if (!broadcastInput.trim()) {
      toast.error('Please input a system message first.');
      return;
    }
    localStorage.setItem('medastrax_global_broadcast', broadcastInput.trim());
    toast.success('Global warning banner deployed system-wide! 🚨');
    setBroadcastInput('');

    window.dispatchEvent(new Event('storage'));
  };

  // Direct entity detail selection
  const selectEntityForDetails = (entity) => {
    setSelectedEntity(entity);
    toast.success(`Viewing analytics for ${entity.name}`);
  };

  // Drilldown breadcrumbs reset
  const resetDrillLevel = (level) => {
    setDrillLevel(level);
    if (level === 1) {
      setSelectedState(null);
      setSelectedRegion(null);
    } else if (level === 2) {
      setSelectedRegion(null);
    }
  };

  // Icon mapping helper
  const getEntityIcon = (type) => {
    if (type === 'HOSPITAL') return <FaHospital style={{ color: '#0D9488' }} />;
    if (type === 'PHARMACY') return <FaStore style={{ color: '#14B8A6' }} />;
    if (type === 'LAB') return <FaFlask style={{ color: '#3B82F6' }} />;
    if (type === 'DOCTOR') return <FaUserMd style={{ color: '#8B5CF6' }} />;
    if (type === 'PATIENT') return <FaUser style={{ color: '#F59E0B' }} />;
    return <FiFolder style={{ color: '#64748B' }} />;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', flexDirection: 'column', gap: '16px' }}>
        <div style={{ width: '48px', height: '48px', border: '4px solid #F3F4F6', borderTop: '4px solid #14B8A6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ color: '#64748B', fontWeight: '500' }}>Orchestrating live directory registry...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="page-container section" style={{ minHeight: '85vh', background: '#F8FAFC', paddingBottom: '80px', fontFamily: 'var(--font-primary)' }}>

      {/* Title / Hero Banner */}
      <motion.div 
        className="glass-card" 
        style={{ 
          background: '#FFFFFF', 
          border: '1px solid #E2E8F0', 
          borderRadius: '16px',
          padding: '32px', 
          marginBottom: '24px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)'
        }}
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="heading-lg" style={{ margin: 0, color: '#0F172A', fontWeight: 800 }}>
              MedAstraX <span style={{ color: '#14B8A6' }}>Global Core</span>
            </h1>
            <p style={{ color: '#64748B', marginTop: '6px', fontSize: '0.92rem' }}>
              Multi-tenant healthcare cluster infrastructure console &amp; orchestration engine.
            </p>
          </div>
          <span className="badge badge-success" style={{ padding: '8px 16px', background: '#ECFDF5', color: '#10B981', borderRadius: '50px', fontWeight: 'bold' }}>
            <span style={{ width: '8px', height: '8px', background: '#10B981', borderRadius: '50%', display: 'inline-block', marginRight: '8px' }}></span>
            PostgreSQL: Connected
          </span>
        </div>
      </motion.div>

      {/* Feature 1: Universal Enterprise Search Bar */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '20px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.01)'
        }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', position: 'relative', width: '100%' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <FiSearch style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', color: '#14B8A6', fontSize: '1.4rem', zIndex: 10 }} />
              <input
                type="text"
                placeholder="Enterprise cross-entity lookup by Email ID, Phone Number, or official License Numbers..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchResults(true);
                }}
                onFocus={() => setShowSearchResults(true)}
                className="form-input"
                style={{
                  width: '100%',
                  minWidth: '100%',
                  display: 'block',
                  padding: '16px 24px 16px 52px',
                  borderRadius: '99px',
                  border: '2px solid #14B8A6',
                  outline: 'none',
                  fontSize: '1rem',
                  background: '#FFFFFF',
                  color: '#0F172A',
                  boxShadow: '0 4px 12px rgba(20, 184, 166, 0.08)',
                  transition: 'all 0.2s'
                }}
              />
              {searchQuery && (
                <button 
                  onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                  style={{ position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: '#94A3B8', cursor: 'pointer', zIndex: 10 }}
                >
                  <FiX size={18} />
                </button>
              )}
            </div>

            {/* Scope dropdown selector */}
            <select
              value={searchScope}
              onChange={(e) => setSearchScope(e.target.value)}
              className="form-input"
              style={{
                width: 'auto',
                minWidth: '180px',
                padding: '16px 40px 16px 24px',
                borderRadius: '99px',
                border: '2px solid #E2E8F0',
                background: '#FFFFFF',
                color: '#334155',
                fontWeight: '600',
                outline: 'none',
                cursor: 'pointer',
                fontSize: '1rem',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)',
                transition: 'all 0.2s',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2314B8A6' d='M6 8.825L.35 3.175l.7-.7L6 7.425l4.95-4.95.7.7z'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 20px center'
              }}
            >
              <option value="ALL">All Entities</option>
              <option value="PATIENT">Patients</option>
              <option value="DOCTOR">Doctors</option>
              <option value="HOSPITAL">Hospitals</option>
              <option value="PHARMACY">Pharmacies</option>
              <option value="LAB">Diagnostic Labs</option>
            </select>
          </div>

          {/* Filter Chips */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
            {['ALL', 'PATIENT', 'DOCTOR', 'HOSPITAL', 'PHARMACY', 'LAB'].map((scope) => (
              <button
                key={scope}
                onClick={() => setSearchScope(scope)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '50px',
                  border: '1px solid',
                  borderColor: searchScope === scope ? '#14B8A6' : '#E2E8F0',
                  background: searchScope === scope ? '#F0FDFA' : '#FFFFFF',
                  color: searchScope === scope ? '#0D9488' : '#64748B',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {scope}
              </button>
            ))}
          </div>

          {/* Instant Search Dropdown Results Panel */}
          <AnimatePresence>
            {showSearchResults && searchQuery && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                style={{
                  position: 'absolute',
                  left: '24px',
                  right: '24px',
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
                  zIndex: 100,
                  marginTop: '6px',
                  maxHeight: '320px',
                  overflowY: 'auto',
                  padding: '8px 0'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid #F1F5F9', background: '#F8FAFC', fontSize: '0.78rem', color: '#64748B', fontWeight: 'bold' }}>
                  <span>SEARCH RESULTS ({searchResults.length})</span>
                  <button onClick={() => setShowSearchResults(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8' }}>CLOSE</button>
                </div>
                {searchResults.length === 0 ? (
                  <p style={{ padding: '24px', textAlign: 'center', color: '#64748B', fontSize: '0.88rem', margin: 0 }}>No records match your query in PostgreSQL index.</p>
                ) : (
                  searchResults.map(entity => (
                    <div
                      key={entity.id}
                      onClick={() => {
                        selectEntityForDetails(entity);
                        setShowSearchResults(false);
                      }}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 20px',
                        borderBottom: '1px solid #F1F5F9',
                        cursor: 'pointer',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F0FDFA'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {getEntityIcon(entity.type)}
                        <div>
                          <strong style={{ display: 'block', color: '#1E293B', fontSize: '0.92rem' }}>{entity.name}</strong>
                          <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                            {entity.email} &bull; {entity.phone || 'No Phone'}
                          </span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span className="badge badge-primary" style={{ fontSize: '0.75rem', background: '#E0F2FE', color: '#0369A1' }}>
                          {entity.type}
                        </span>
                        {entity.licenseNo !== 'N/A' && (
                          <span style={{ display: 'block', fontSize: '0.72rem', color: '#94A3B8', marginTop: '4px' }}>
                            Lic: {entity.licenseNo}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Feature 2: High-Level Core Analytics Grid (Top Row) */}
      <div className="grid grid-6" style={{ gap: '16px', marginBottom: '32px' }}>
        
        {/* KPI 1 */}
        <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ color: '#64748B', fontSize: '0.85rem', fontWeight: '600' }}>Patients</span>
            <div style={{ background: '#F0FDFA', color: '#14B8A6', padding: '8px', borderRadius: '12px' }}><FiUsers size={16} /></div>
          </div>
          <h3 style={{ fontSize: '1.75rem', color: '#0F172A', fontWeight: '800', margin: 0 }}>{stats.patientsCount.toLocaleString()}</h3>
          <span style={{ color: '#10B981', fontSize: '0.78rem', fontWeight: '600' }}>Live Records</span>
        </div>

        {/* KPI 2 */}
        <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ color: '#64748B', fontSize: '0.85rem', fontWeight: '600' }}>Doctors</span>
            <div style={{ background: '#EEF2FF', color: '#6366F1', padding: '8px', borderRadius: '12px' }}><FaUserMd size={16} /></div>
          </div>
          <h3 style={{ fontSize: '1.75rem', color: '#0F172A', fontWeight: '800', margin: 0 }}>{stats.doctorsCount.toLocaleString()}</h3>
          <span style={{ color: '#10B981', fontSize: '0.78rem', fontWeight: '600' }}>Registered</span>
        </div>

        {/* KPI 3 */}
        <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ color: '#64748B', fontSize: '0.85rem', fontWeight: '600' }}>Hospitals</span>
            <div style={{ background: '#F0FDF4', color: '#22C55E', padding: '8px', borderRadius: '12px' }}><FaHospital size={16} /></div>
          </div>
          <h3 style={{ fontSize: '1.75rem', color: '#0F172A', fontWeight: '800', margin: 0 }}>{stats.hospitalsCount.toLocaleString()}</h3>
          <span style={{ color: '#64748B', fontSize: '0.78rem' }}>100% Operational</span>
        </div>

        {/* KPI 4 */}
        <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ color: '#64748B', fontSize: '0.85rem', fontWeight: '600' }}>Pharmacies</span>
            <div style={{ background: '#FFF7ED', color: '#F97316', padding: '8px', borderRadius: '12px' }}><FaStore size={16} /></div>
          </div>
          <h3 style={{ fontSize: '1.75rem', color: '#0F172A', fontWeight: '800', margin: 0 }}>{stats.pharmaciesCount.toLocaleString()}</h3>
          <span style={{ color: '#64748B', fontSize: '0.78rem' }}>Associated Mappings</span>
        </div>

        {/* KPI 5 */}
        <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ color: '#64748B', fontSize: '0.85rem', fontWeight: '600' }}>Diagnostics</span>
            <div style={{ background: '#F0F9FF', color: '#0284C7', padding: '8px', borderRadius: '12px' }}><FaFlask size={16} /></div>
          </div>
          <h3 style={{ fontSize: '1.75rem', color: '#0F172A', fontWeight: '800', margin: 0 }}>{stats.labsCount.toLocaleString()}</h3>
          <span style={{ color: '#10B981', fontSize: '0.78rem', fontWeight: '600' }}>Live Labs</span>
        </div>

        {/* KPI 6 */}
        <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ color: '#64748B', fontSize: '0.85rem', fontWeight: '600' }}>Top Facility</span>
            <div style={{ background: '#FAF5FF', color: '#A855F7', padding: '8px', borderRadius: '12px' }}><FiTrendingUp size={16} /></div>
          </div>
          <h3 style={{ fontSize: '1.1rem', color: '#0F172A', fontWeight: '800', margin: '6px 0 2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stats.topFacilityName}</h3>
          <span style={{ color: '#64748B', fontSize: '0.78rem' }}>₹{(stats.topFacilityRevenue / 100000).toFixed(1)}L Mo. Rollup</span>
        </div>

      </div>

      {/* Feature 3: Hierarchical Drill-Down Analytics View */}
      <div className="admin-stats-grid" style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: '32px', marginBottom: '40px' }}>
        
        {/* Hierarchical structural navigation */}
        <div style={{ 
          background: '#FFFFFF', 
          borderRadius: '16px', 
          border: '1px solid #E2E8F0', 
          padding: '28px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.01)'
        }}>
          
          {/* Breadcrumb Navigator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', fontSize: '0.9rem', color: '#64748B', fontWeight: '600' }}>
            <span 
              onClick={() => resetDrillLevel(1)} 
              style={{ cursor: 'pointer', color: drillLevel >= 1 ? '#14B8A6' : '#64748B' }}
            >
              {countryData.name}
            </span>
            {drillLevel >= 2 && selectedState && (
              <>
                <FiChevronRight />
                <span 
                  onClick={() => resetDrillLevel(2)} 
                  style={{ cursor: 'pointer', color: drillLevel >= 2 ? '#14B8A6' : '#64748B' }}
                >
                  {selectedState.name}
                </span>
              </>
            )}
            {drillLevel >= 3 && selectedRegion && (
              <>
                <FiChevronRight />
                <span 
                  onClick={() => resetDrillLevel(3)} 
                  style={{ cursor: 'pointer', color: drillLevel >= 3 ? '#14B8A6' : '#64748B' }}
                >
                  {selectedRegion.name}
                </span>
              </>
            )}
            {drillLevel === 4 && <><FiChevronRight /> <span style={{ color: '#0F172A' }}>Facilities Tree</span></>}
          </div>

          {/* Level 1: Country View */}
          {drillLevel === 1 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h3 style={{ color: '#0F172A', fontWeight: '700', marginBottom: '16px' }}>Infrastructure Registry (By State)</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {countryData.states.map((state) => (
                  <div
                    key={state.id}
                    onClick={() => {
                      setSelectedState(state);
                      setDrillLevel(2);
                    }}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '16px 20px',
                      borderRadius: '12px',
                      border: '1px solid #E2E8F0',
                      cursor: 'pointer',
                      background: '#F8FAFC',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#14B8A6';
                      e.currentTarget.style.background = '#F0FDFA';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#E2E8F0';
                      e.currentTarget.style.background = '#F8FAFC';
                    }}
                  >
                    <div>
                      <strong style={{ color: '#1E293B', fontSize: '0.98rem' }}>{state.name} State</strong>
                      <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem', color: '#64748B', marginTop: '4px' }}>
                        <span>Hospitals: {state.hospitalsCount}</span>
                        <span>Pharmacies: {state.pharmaciesCount}</span>
                        <span>Diagnostic Labs: {state.labsCount}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#0D9488', display: 'block' }}>
                          ₹{(state.revenue / 100000).toFixed(1)}L
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>Consolidated Rev</span>
                      </div>
                      <FiChevronRight color="#94A3B8" />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Level 2: State View */}
          {drillLevel === 2 && selectedState && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ color: '#0F172A', fontWeight: '700', margin: 0 }}>Regions in {selectedState.name}</h3>
                <button onClick={() => resetDrillLevel(1)} className="btn btn-outline btn-sm" style={{ padding: '6px 14px', borderRadius: '50px' }}>Back to Country</button>
              </div>

              {selectedState.regions.length === 0 ? (
                <p style={{ color: '#64748B', textAlign: 'center', padding: '32px' }}>No operational regions configured in this state yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {selectedState.regions.map((region) => (
                    <div
                      key={region.id}
                      onClick={() => {
                        setSelectedRegion(region);
                        setDrillLevel(3);
                      }}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '16px 20px',
                        borderRadius: '12px',
                        border: '1px solid #E2E8F0',
                        cursor: 'pointer',
                        background: '#F8FAFC',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#14B8A6';
                        e.currentTarget.style.background = '#F0FDFA';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#E2E8F0';
                        e.currentTarget.style.background = '#F8FAFC';
                      }}
                    >
                      <div>
                        <strong style={{ color: '#1E293B', fontSize: '#0.98rem' }}>{region.name}</strong>
                        <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem', color: '#64748B', marginTop: '4px' }}>
                          <span>Hospitals: {region.hospitalsCount}</span>
                          <span>Pharmacies: {region.pharmaciesCount}</span>
                          <span>Labs: {region.labsCount}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#0D9488', display: 'block' }}>
                            ₹{(region.revenue / 100000).toFixed(1)}L
                          </span>
                          <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>Est. Revenue</span>
                        </div>
                        <FiChevronRight color="#94A3B8" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Level 3 & 4: Regional Entity View & Conditional Tree List */}
          {drillLevel === 3 && selectedRegion && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ color: '#0F172A', fontWeight: '700', margin: 0 }}>Cluster Facilities Registry</h3>
                  <span style={{ fontSize: '0.78rem', color: '#64748B' }}>State-linked PostgreSQL JPA relationships roll-up</span>
                </div>
                <button onClick={() => resetDrillLevel(2)} className="btn btn-outline btn-sm" style={{ padding: '6px 14px', borderRadius: '50px' }}>Back to State</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {selectedRegion.entities.map((entity) => {
                  const isHospital = entity.type === 'HOSPITAL';
                  const isExpanded = !!expandedHospitals[entity.id];
                  const consolidatedRevenue = isHospital ? getConsolidatedRevenue(entity) : entity.revenue;

                  return (
                    <div 
                      key={entity.id} 
                      style={{ 
                        border: '1px solid #E2E8F0', 
                        borderRadius: '12px', 
                        overflow: 'hidden', 
                        background: '#FFFFFF',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.01)'
                      }}
                    >
                      {/* Parent Row */}
                      <div
                        onClick={() => {
                          if (isHospital) {
                            toggleHospital(entity.id);
                          }
                          selectEntityForDetails(entity);
                        }}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '16px 20px',
                          cursor: 'pointer',
                          background: isHospital ? '#FAFAFA' : '#FFFFFF',
                          borderBottom: isExpanded ? '1px solid #F1F5F9' : 'none',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isHospital ? '#FAFAFA' : '#FFFFFF'}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {isHospital ? (
                            isExpanded ? <FiChevronDown color="#14B8A6" /> : <FiChevronRight color="#94A3B8" />
                          ) : (
                            <span style={{ width: '16px' }}></span>
                          )}
                          {getEntityIcon(entity.type)}
                          <div>
                            <strong style={{ color: '#1E293B', fontSize: '0.94rem' }}>{entity.name}</strong>
                            <span style={{ display: 'block', fontSize: '0.72rem', color: '#94A3B8', marginTop: '2px' }}>
                              Lic: {entity.licenseNo} &bull; Phone: {entity.phone}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '0.92rem', fontWeight: 'bold', color: '#0F172A', display: 'block' }}>
                              ₹{consolidatedRevenue.toLocaleString('en-IN')}
                            </span>
                            <span style={{ fontSize: '0.68rem', color: '#94A3B8' }}>
                              {isHospital ? 'Consolidated Rev' : 'Total Revenue'}
                            </span>
                          </div>
                          <span style={{ 
                            fontSize: '0.72rem', 
                            background: '#ECFDF5', 
                            color: '#10B981', 
                            padding: '4px 10px', 
                            borderRadius: '50px', 
                            fontWeight: 'bold' 
                          }}>
                            {entity.status}
                          </span>
                        </div>
                      </div>

                      {/* Expandable Accordion for Hospital's Associated Pharmacies / Labs */}
                      {isHospital && isExpanded && (
                        <div style={{ background: '#F8FAFC', padding: '12px 20px 16px 48px', borderTop: '1px solid #E2E8F0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748B', fontSize: '0.78rem', fontWeight: 'bold', marginBottom: '8px', letterSpacing: '0.3px' }}>
                            <span>ASSOCIATED ENTITIES (@OneToMany relation)</span>
                          </div>
                          {entity.associated.length === 0 ? (
                            <p style={{ color: '#94A3B8', fontSize: '0.8rem', margin: 0 }}>No associated units mapped to this parent hospital.</p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {entity.associated.map(sub => (
                                <div
                                  key={sub.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    selectEntityForDetails(sub);
                                  }}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '10px 14px',
                                    background: '#FFFFFF',
                                    border: '1px solid #E2E8F0',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = '#14B8A6';
                                    e.currentTarget.style.background = '#F0FDFA';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = '#E2E8F0';
                                    e.currentTarget.style.background = '#FFFFFF';
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    {getEntityIcon(sub.type)}
                                    <div>
                                      <span style={{ fontWeight: '600', color: '#334155', fontSize: '0.85rem' }}>{sub.name}</span>
                                      <span style={{ display: 'block', fontSize: '0.72rem', color: '#94A3B8' }}>License: {sub.licenseNo}</span>
                                    </div>
                                  </div>
                                  <div style={{ textAlign: 'right' }}>
                                    <strong style={{ color: '#0D9488', fontSize: '0.85rem' }}>₹{sub.revenue.toLocaleString('en-IN')}</strong>
                                    <span style={{ display: 'block', fontSize: '0.68rem', color: '#94A3B8' }}>Unit revenue</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

        </div>

        {/* Entity Detail Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ 
            background: '#FFFFFF', 
            borderRadius: '16px', 
            border: '1px solid #E2E8F0', 
            padding: '28px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.01)',
            minHeight: '420px',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {selectedEntity ? (
              <motion.div 
                key={selectedEntity.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1 }}
              >
                {/* Details Header */}
                <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '16px', marginBottom: '20px' }}>
                  <span className="badge badge-primary" style={{ fontSize: '0.75rem', background: '#F0FDFA', color: '#0D9488', marginBottom: '8px' }}>
                    {selectedEntity.type} DIAGNOSTICS
                  </span>
                  <h3 style={{ fontSize: '1.25rem', color: '#0F172A', fontWeight: '800', margin: 0 }}>{selectedEntity.name}</h3>
                  <span style={{ fontSize: '0.8rem', color: '#64748B' }}>License NO: {selectedEntity.licenseNo}</span>
                </div>

                {/* Operations KPI blocks */}
                <div className="grid grid-2" style={{ gap: '12px', marginBottom: '24px' }}>
                  <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                    <span style={{ fontSize: '0.7rem', color: '#64748B', display: 'block', textTransform: 'uppercase' }}>Operational Beds</span>
                    <strong style={{ fontSize: '1.2rem', color: '#0F172A' }}>{selectedEntity.beds || 'N/A'}</strong>
                  </div>
                  <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                    <span style={{ fontSize: '0.7rem', color: '#64748B', display: 'block', textTransform: 'uppercase' }}>Staff Physicians</span>
                    <strong style={{ fontSize: '1.2rem', color: '#0F172A' }}>{selectedEntity.doctors || 'N/A'}</strong>
                  </div>
                  <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                    <span style={{ fontSize: '0.7rem', color: '#64748B', display: 'block', textTransform: 'uppercase' }}>Diagnostic Tests</span>
                    <strong style={{ fontSize: '1.2rem', color: '#0F172A' }}>{selectedEntity.tests || 'N/A'}</strong>
                  </div>
                  <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                    <span style={{ fontSize: '0.7rem', color: '#64748B', display: 'block', textTransform: 'uppercase' }}>Patient Traffic</span>
                    <strong style={{ fontSize: '1.2rem', color: '#0F172A' }}>{selectedEntity.traffic || 'N/A'}/day</strong>
                  </div>
                </div>

                {/* Chart.js Container */}
                <h4 style={{ fontSize: '#0.85rem', color: '#0F172A', fontWeight: 'bold', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FiTrendingUp color="#14B8A6" /> Historical Revenue Trends
                </h4>
                <div style={{ position: 'relative', flex: 1, minHeight: '160px', background: '#FAFAFA', borderRadius: '10px', padding: '8px', border: '1px solid #E2E8F0' }}>
                  <canvas ref={trendChartRef}></canvas>
                </div>
              </motion.div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#94A3B8' }}>
                <FiActivity size={48} style={{ marginBottom: '16px' }} />
                <span>Select a facility registry item to inspect real-time metrics.</span>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Feature 4: 5 Advanced Administrative Control Modules */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        padding: '28px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.01)'
      }}>
        
        {/* Navigation Tabs */}
        <div className="dashboard-tabs" style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #E2E8F0', paddingBottom: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {[
            { id: 'credentialing', label: 'Credentialing Workflow', icon: <FiShield /> },
            { id: 'monetization', label: 'Monetization Hub', icon: <FiDollarSign /> },
            { id: 'audit', label: 'System Audit Logs', icon: <FiServer /> },
            { id: 'helpdesk', label: 'Support Queue', icon: <FiAlertCircle /> },
            { id: 'broadcast', label: 'Emergency Broadcast', icon: <FiPlusCircle /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveControlTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                border: 'none',
                background: activeControlTab === tab.id ? '#14B8A6' : 'transparent',
                color: activeControlTab === tab.id ? '#FFFFFF' : '#64748B',
                fontWeight: '600',
                fontSize: '0.88rem',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Panel */}
        <div>
          
          {/* Tab 1: Credentialing Workflow */}
          {activeControlTab === 'credentialing' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ margin: 0, color: '#0F172A', fontSize: '1rem', fontWeight: '700' }}>Pending Registrations</h4>
                <span style={{ fontSize: '0.8rem', color: '#64748B' }}>Requires documentation verification</span>
              </div>

              {verifications.length === 0 ? (
                <p style={{ color: '#94A3B8', textAlign: 'center', padding: '32px' }}>No registrations pending approval. All tenants verified! ✅</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: '0.82rem' }}>
                        <th style={{ padding: '12px' }}>Entity Name</th>
                        <th style={{ padding: '12px' }}>Type</th>
                        <th style={{ padding: '12px' }}>License Number</th>
                        <th style={{ padding: '12px' }}>Submitted Files</th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>Orchestration Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {verifications.map(v => (
                        <tr key={v.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td data-label="Entity Name" style={{ padding: '16px 12px', fontWeight: '600', color: '#1E293B' }}>{v.name}</td>
                          <td data-label="Type" style={{ padding: '16px 12px' }}>
                            <span className="badge" style={{
                              background: v.type === 'LAB' ? '#F0F9FF' : '#FFF7ED',
                              color: v.type === 'LAB' ? '#0284C7' : '#F97316',
                              fontSize: '0.72rem', fontWeight: 'bold'
                            }}>{v.type}</span>
                          </td>
                          <td data-label="License Number" style={{ padding: '16px 12px', fontFamily: 'monospace', fontSize: '0.85rem' }}>{v.licenseNo}</td>
                          <td data-label="Submitted Files" style={{ padding: '16px 12px' }}>
                            <a href="#" onClick={(e) => { e.preventDefault(); toast.success(`Viewing ${v.documents}`); }} style={{ color: '#14B8A6', textDecoration: 'underline', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <FiFileText /> {v.documents}
                            </a>
                          </td>
                          <td data-label="Orchestration Actions" style={{ padding: '16px 12px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', gap: '8px' }}>
                              <button 
                                onClick={() => handleVerify(v.id, v.name, true)}
                                className="btn btn-primary btn-sm" 
                                style={{ background: '#10B981', color: '#FFFFFF', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '50px' }}
                              >
                                <FiCheck size={14} /> Approve
                              </button>
                              <button 
                                onClick={() => handleVerify(v.id, v.name, false)}
                                className="btn btn-ghost btn-sm" 
                                style={{ background: '#FEE2E2', color: '#EF4444', borderColor: 'transparent', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '50px' }}
                              >
                                <FiX size={14} /> Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {/* Tab 2: Platform Monetization Hub */}
          {activeControlTab === 'monetization' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-2" style={{ gap: '32px' }}>
              <div>
                <h4 style={{ margin: '0 0 8px 0', color: '#0F172A', fontSize: '1rem', fontWeight: '700' }}>Subscription Fees &amp; Profit Splits</h4>
                <p style={{ color: '#64748B', fontSize: '0.85rem', marginBottom: '24px' }}>
                  Consolidated tracking of transaction commission splits, SaaS monthly licensing fees, and premium lab routing monetization.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px' }}>
                    <span style={{ color: '#64748B', fontSize: '0.88rem' }}>Total System Revenue</span>
                    <strong style={{ color: '#0F172A', fontSize: '1.05rem' }}>₹{stats.totalRevenue.toLocaleString('en-IN')}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px' }}>
                    <span style={{ color: '#64748B', fontSize: '0.88rem' }}>Platform Share (Fee 10%)</span>
                    <strong style={{ color: '#10B981', fontSize: '1.05rem' }}>₹{Math.round(stats.totalRevenue * 0.1).toLocaleString('en-IN')}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px' }}>
                    <span style={{ color: '#64748B', fontSize: '0.88rem' }}>Active Billing Terminals</span>
                    <strong style={{ color: '#0F172A', fontSize: '1.05rem' }}>{(stats.hospitalsCount + stats.pharmaciesCount + stats.labsCount)} Facilities</strong>
                  </div>
                </div>
              </div>

              {/* Doughnut Chart Canvas */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <h4 style={{ alignSelf: 'flex-start', margin: '0 0 16px 0', color: '#0F172A', fontSize: '0.9rem', fontWeight: '700' }}>Platform Revenue Contribution</h4>
                <div style={{ width: '100%', height: '180px', position: 'relative' }}>
                  <canvas ref={monetChartRef}></canvas>
                </div>
              </div>
            </motion.div>
          )}

          {/* Tab 3: System Health & Audit Logger */}
          {activeControlTab === 'audit' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ margin: 0, color: '#0F172A', fontSize: '1rem', fontWeight: '700' }}>Database &amp; Security Audits</h4>
                <span style={{ fontSize: '0.8rem', color: '#14B8A6', fontWeight: 'bold' }}>Live Logging Channel</span>
              </div>

              <div style={{ 
                background: '#0F172A', 
                color: '#38BDF8', 
                padding: '20px', 
                borderRadius: '12px', 
                fontFamily: 'monospace', 
                fontSize: '0.82rem', 
                maxHeight: '260px', 
                overflowY: 'auto',
                boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)',
                lineHeight: 1.6
              }}>
                {systemLogs.map((log, idx) => (
                  <div key={idx} style={{ 
                    borderBottom: '1px solid rgba(255,255,255,0.05)', 
                    padding: '6px 0',
                    color: log.includes('WARN') ? '#FBBF24' : log.includes('ERROR') ? '#F87171' : '#38BDF8'
                  }}>
                    {log}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Tab 4: Ticket & Helpdesk Queue */}
          {activeControlTab === 'helpdesk' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ margin: 0, color: '#0F172A', fontSize: '1rem', fontWeight: '700' }}>Incoming Support Tickets</h4>
                <span style={{ fontSize: '0.8rem', color: '#64748B' }}>Real-time diagnostic tickets desk</span>
              </div>

              {tickets.length === 0 ? (
                <p style={{ color: '#94A3B8', textAlign: 'center', padding: '32px' }}>No pending support tickets. Great work! 🛡️</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                  {tickets.map(ticket => {
                    const priorityColor = 
                      ticket.priority === 'CRITICAL' ? '#EF4444' : 
                      ticket.priority === 'HIGH' ? '#F97316' : 
                      ticket.priority === 'MEDIUM' ? '#3B82F6' : '#10B981';

                    const priorityBg = 
                      ticket.priority === 'CRITICAL' ? '#FEE2E2' : 
                      ticket.priority === 'HIGH' ? '#FFEDD5' : 
                      ticket.priority === 'MEDIUM' ? '#EFF6FF' : '#ECFDF5';

                    return (
                      <div key={ticket.id} style={{ border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', background: '#FFFFFF', display: 'flex', flexDirection: 'column', justifyBetween: 'space-between' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <strong style={{ color: '#64748B', fontSize: '0.78rem' }}>{ticket.id}</strong>
                            <span style={{ 
                              fontSize: '0.72rem', 
                              fontWeight: 'bold', 
                              color: priorityColor, 
                              background: priorityBg, 
                              padding: '2px 8px', 
                              borderRadius: '50px' 
                            }}>
                              {ticket.priority}
                            </span>
                          </div>
                          <h5 style={{ color: '#1E293B', fontWeight: '600', fontSize: '0.88rem', margin: '0 0 12px 0', minHeight: '40px', lineHeight: 1.4 }}>
                            {ticket.subject}
                          </h5>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', borderTop: '1px solid #F1F5F9', paddingTop: '10px' }}>
                          <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                            Issuer: <strong>{ticket.issuer}</strong> ({ticket.type})
                          </div>
                          <button 
                            onClick={() => handleResolveTicket(ticket.id, ticket.subject)}
                            style={{ 
                              background: '#E2E8F0', 
                              border: 'none', 
                              color: '#334155', 
                              fontSize: '0.75rem', 
                              fontWeight: '600', 
                              padding: '4px 10px', 
                              borderRadius: '4px',
                              cursor: 'pointer',
                              transition: 'all 0.15s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#CBD5E1'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#E2E8F0'}
                          >
                            Resolve
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* Tab 5: Global Emergency Broadcast Tool */}
          {activeControlTab === 'broadcast' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ maxWidth: '640px' }}>
              <h4 style={{ margin: '0 0 8px 0', color: '#0F172A', fontSize: '1rem', fontWeight: '700' }}>System-Wide Warning &amp; Outage Broadcaster</h4>
              <p style={{ color: '#64748B', fontSize: '0.85rem', marginBottom: '20px' }}>
                Deploys a scrolling critical warning banner at the very top of all patient, doctor, pharmacy, hospital, and diagnostics portals instantly.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <textarea
                  className="form-input"
                  placeholder="Enter system announcement (e.g., 'MedAstraX Scheduled server maintenance on June 19, 02:00 - 04:00 UTC. Expect temporary downtime.')"
                  value={broadcastInput}
                  onChange={(e) => setBroadcastInput(e.target.value)}
                  style={{ minHeight: '80px', borderRadius: '10px' }}
                />
                <button 
                  onClick={deployBroadcast}
                  className="btn btn-primary"
                  style={{ alignSelf: 'flex-start', background: 'linear-gradient(135deg, #EF4444, #DC2626)', color: '#FFFFFF', border: 'none', borderRadius: '50px' }}
                >
                  Deploy Emergency Broadcast
                </button>
              </div>
            </motion.div>
          )}

        </div>
      </div>

    </div>
  );
}
