import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiChevronRight, 
  FiChevronLeft, 
  FiFileText, 
  FiCheckCircle, 
  FiUploadCloud, 
  FiTrash2, 
  FiActivity, 
  FiCpu 
} from 'react-icons/fi';
import { aiAPI, fileAPI } from '../../services/api';
import toast from 'react-hot-toast';

// Dictionary mapping region numbers to clinical labels
const ZONE_NAMES = {
  // Front View
  1: "Head / Skull Area (Right)",
  2: "Head / Skull Area (Left)",
  3: "Neck (Front)",
  4: "Shoulder / Clavicle (Right)",
  5: "Shoulder / Clavicle (Left)",
  6: "Upper Arm (Right)",
  7: "Upper Arm (Left)",
  8: "Forearm (Right)",
  9: "Forearm (Left)",
  10: "Hand / Wrist (Right)",
  11: "Hand / Wrist (Left)",
  12: "Chest / Pectoral (Right)",
  13: "Chest / Pectoral (Left)",
  14: "Abdomen (Upper Right)",
  15: "Abdomen (Upper Left)",
  16: "Groin / Pelvis Area",
  17: "Thigh (Right)",
  18: "Thigh (Left)",
  49: "Knee / Shin (Right)",
  50: "Knee / Shin (Left)",
  19: "Lower Leg (Right)",
  20: "Lower Leg (Left)",
  21: "Foot (Right)",
  22: "Foot (Left)",
  
  // Back View
  23: "Head / Occipital (Back Left)",
  24: "Head / Occipital (Back Right)",
  25: "Neck (Back)",
  26: "Shoulder / Upper Back (Right)",
  27: "Shoulder / Upper Back (Left)",
  28: "Upper Arm (Back Right)",
  29: "Upper Arm (Back Left)",
  30: "Forearm (Back Right)",
  31: "Forearm (Back Left)",
  32: "Hand / Wrist (Back Right)",
  33: "Hand / Wrist (Back Left)",
  34: "Upper Back (Right)",
  35: "Upper Back (Left)",
  36: "Lower Back (Right)",
  37: "Lower Back (Left)",
  46: "Sacrum / Lower Spine",
  38: "Buttock (Right)",
  39: "Buttock (Left)",
  40: "Thigh (Back Right)",
  41: "Thigh (Back Left)",
  42: "Calf (Right)",
  43: "Calf (Left)",
  47: "Ankle / Heel (Right)",
  48: "Ankle / Heel (Left)",
  44: "Foot (Back Right)",
  45: "Foot (Back Left)"
};

export default function BodyMapSymptomFlow() {
  const [step, setStep] = useState(1);
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [hoveredRegion, setHoveredRegion] = useState(null);
  
  // Stores details per selected region: { [id]: { severity: 5, duration: '1-3 days', description: '' } }
  const [symptomDetails, setSymptomDetails] = useState({});
  
  // Medication status states
  const [onMedication, setOnMedication] = useState(false);
  const [prescriptionDetails, setPrescriptionDetails] = useState('');
  const [prescriptionImage, setPrescriptionImage] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // API Call Status States
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState('');
  const [aiModelUsed, setAiModelUsed] = useState('');

  const fileInputRef = useRef(null);

  const toggleRegion = (id) => {
    let updated;
    if (selectedRegions.includes(id)) {
      updated = selectedRegions.filter(x => x !== id);
      const copy = { ...symptomDetails };
      delete copy[id];
      setSymptomDetails(copy);
    } else {
      updated = [...selectedRegions, id];
      setSymptomDetails(prev => ({
        ...prev,
        [id]: { severity: 5, duration: '1-3 days', description: '' }
      }));
    }
    setSelectedRegions(updated);
  };

  const handleDetailChange = (id, field, value) => {
    setSymptomDetails(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  };

  // Upload handler for prescription images
  const handleFileUpload = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG/JPG)');
      return;
    }

    try {
      setUploadingImage(true);
      const response = await fileAPI.upload(file);
      if (response.data && response.data.success) {
        const relativeUrl = response.data.message;
        const backendBase = import.meta.env.VITE_API_URL 
          ? import.meta.env.VITE_API_URL.replace('/api', '') 
          : ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://localhost:8083'
            : 'https://mediverse-ke9x.onrender.com');
        
        setPrescriptionImage(`${backendBase}${relativeUrl}`);
        toast.success('Prescription image uploaded successfully!');
      } else {
        toast.error('Failed to upload image');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error uploading image');
    } finally {
      setUploadingImage(false);
    }
  };

  const onDragOver = (e) => {
    e.preventDefault();
  };

  const onDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFormSubmit = async () => {
    const symptomsPayload = selectedRegions.map(id => ({
      regionId: id,
      bodyPart: ZONE_NAMES[id],
      severity: symptomDetails[id]?.severity || 5,
      duration: symptomDetails[id]?.duration || '1-3 days',
      description: symptomDetails[id]?.description || ''
    }));

    const payload = {
      symptoms: symptomsPayload,
      onMedication,
      prescriptionDetails: onMedication ? prescriptionDetails : '',
      prescriptionImage: onMedication ? prescriptionImage : ''
    };

    try {
      setLoading(true);
      setStep(3);
      const res = await aiAPI.analyzeBodySymptoms(payload);
      if (res.data && res.data.success) {
        setAnalysisResult(res.data.analysis);
        setAiModelUsed(res.data.model);
        toast.success('Symptom triage report generated!');
      } else {
        toast.error('Failed to generate analysis.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Triage request failed. Check server connection.');
    } finally {
      setLoading(false);
    }
  };

  const parseMarkdownResponse = (text) => {
    if (!text) return null;
    return text.split('\n').map((line, idx) => {
      let trimmed = line.trim();
      if (trimmed.startsWith('###')) {
        return <h3 key={idx} className="heading-sm" style={{ marginTop: '24px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>{trimmed.replace('###', '')}</h3>;
      }
      if (trimmed.startsWith('##')) {
        return <h2 key={idx} className="heading-md text-gradient" style={{ marginTop: '32px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>{trimmed.replace('##', '')}</h2>;
      }
      if (trimmed.startsWith('#')) {
        return <h1 key={idx} className="heading-lg" style={{ marginTop: '36px', marginBottom: '20px' }}>{trimmed.replace('#', '')}</h1>;
      }
      if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
        const clean = trimmed.substring(1).trim();
        return (
          <li key={idx} style={{ marginLeft: '24px', marginBottom: '8px', listStyleType: 'disc', color: 'var(--text-secondary)' }} 
              dangerouslySetInnerHTML={{ __html: formatBoldAndItalic(clean) }} />
        );
      }
      if (trimmed === '---') {
        return <div key={idx} className="divider" />;
      }
      if (trimmed.length === 0) {
        return <div key={idx} style={{ height: '8px' }} />;
      }
      return (
        <p key={idx} style={{ marginBottom: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }} 
           dangerouslySetInnerHTML={{ __html: formatBoldAndItalic(trimmed) }} />
      );
    });
  };

  const formatBoldAndItalic = (text) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
  };

  // Helper renderer for each SVG zone hotspot
  const renderSvgZone = (id, pointsStr, type = 'polygon', dPath = '') => {
    const isSelected = selectedRegions.includes(id);
    const isHovered = hoveredRegion === id;
    
    const fillStyle = isSelected 
      ? 'rgba(239, 68, 68, 0.3)' 
      : isHovered 
        ? 'rgba(29, 158, 117, 0.2)' 
        : 'rgba(255, 255, 255, 0.6)';
        
    const strokeStyle = isSelected 
      ? '#EF4444' 
      : isHovered 
        ? 'var(--primary)' 
        : 'rgba(45, 42, 61, 0.15)';
        
    const strokeWidth = isSelected || isHovered ? 2.5 : 1.2;

    const props = {
      points: type === 'polygon' ? pointsStr : undefined,
      d: type === 'path' ? dPath : undefined,
      fill: fillStyle,
      stroke: strokeStyle,
      strokeWidth: strokeWidth,
      style: { transition: 'all 0.2s ease', cursor: 'pointer' },
      onClick: () => toggleRegion(id),
      onMouseEnter: () => setHoveredRegion(id),
      onMouseLeave: () => setHoveredRegion(null)
    };

    return type === 'polygon' ? <polygon key={id} {...props} /> : <path key={id} {...props} />;
  };

  return (
    <div className="glass-card" style={{ padding: '32px', borderRadius: '24px', marginTop: '24px', border: '1px solid var(--border-color)' }}>
      
      {/* Step Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
        <div>
          <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '1px', color: 'var(--primary)', display: 'block', marginBottom: '4px' }}>AI Symptom Assistant</span>
          <h2 className="heading-md" style={{ margin: 0 }}>
            {step === 1 && "Step 1: Locate Symptomatic Regions"}
            {step === 2 && "Step 2: Describe Symptoms Details"}
            {step === 3 && "Step 3: AI Triage Advice"}
          </h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ height: '32px', width: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.85rem', background: step >= 1 ? 'var(--primary)' : 'var(--bg-secondary)', color: step >= 1 ? 'white' : 'var(--text-secondary)', transition: 'all 0.3s' }}>1</span>
          <span style={{ height: '2px', width: '24px', background: 'var(--border-color)' }}></span>
          <span style={{ height: '32px', width: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.85rem', background: step >= 2 ? 'var(--primary)' : 'var(--bg-secondary)', color: step >= 2 ? 'white' : 'var(--text-secondary)', transition: 'all 0.3s' }}>2</span>
          <span style={{ height: '2px', width: '24px', background: 'var(--border-color)' }}></span>
          <span style={{ height: '32px', width: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.85rem', background: step >= 3 ? 'var(--primary)' : 'var(--bg-secondary)', color: step >= 3 ? 'white' : 'var(--text-secondary)', transition: 'all 0.3s' }}>3</span>
        </div>
      </div>

      {/* STEP 1: INTERACTIVE BODY MAP */}
      {step === 1 && (
        <div className="animate-fade-in">
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.9rem' }}>
            Please click on the affected body regions below. You can select multiple areas. Left and right regions are assessed independently.
          </p>

          {/* Interactive Split Panel Grid - Force Side-by-Side */}
          <div style={{ display: 'flex', flexDirection: 'row', gap: '32px', justifyContent: 'center', flexWrap: 'wrap', width: '100%', marginBottom: '32px' }}>
            
            {/* Front View Panel */}
            <div className="body-map-panel" style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px', background: 'rgba(255, 255, 255, 0.4)', borderRadius: '20px', border: '1px solid var(--border-color)', maxWidth: '340px' }}>
              <span style={{ fontWeight: '800', fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '1.5px', marginBottom: '16px' }}>Front View</span>
              <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
                <svg width="100%" height="auto" viewBox="0 0 320 600" className="select-none" style={{ maxWidth: '300px', maxHeight: '560px' }}>
                  <g opacity="0.1">
                    <circle cx="160" cy="65" r="32" fill="var(--text-primary)" />
                    <rect x="145" y="85" width="30" height="25" rx="4" fill="var(--text-primary)" />
                    <rect x="110" y="110" width="100" height="150" rx="16" fill="var(--text-primary)" />
                  </g>

                  {/* Render Front Hotspots */}
                  {/* Head Left/Right */}
                  {renderSvgZone(1, '', 'path', 'M 160 30 A 30 35 0 0 0 130 65 L 160 65 Z')}
                  {renderSvgZone(2, '', 'path', 'M 160 30 A 30 35 0 0 1 190 65 L 160 65 Z')}
                  {/* Neck */}
                  {renderSvgZone(3, '148,65 172,65 175,90 145,90')}
                  {/* Shoulders */}
                  {renderSvgZone(4, '145,90 145,110 95,120 100,95')}
                  {renderSvgZone(5, '175,90 175,110 225,120 220,95')}
                  {/* Chest */}
                  {renderSvgZone(12, '110,110 160,110 160,170 110,170')}
                  {renderSvgZone(13, '160,110 210,110 210,170 160,170')}
                  {/* Abdomen */}
                  {renderSvgZone(14, '110,170 160,170 160,230 115,230')}
                  {renderSvgZone(15, '160,170 210,170 205,230 160,230')}
                  {/* Groin */}
                  {renderSvgZone(16, '115,230 205,230 160,265')}
                  
                  {/* Right Arm */}
                  {renderSvgZone(6, '100,95 110,110 90,195 78,185')}
                  {renderSvgZone(8, '78,185 90,195 65,275 52,265')}
                  {renderSvgZone(10, '', 'path', 'M 52 265 L 65 275 L 45 320 L 30 300 Z')}

                  {/* Left Arm */}
                  {renderSvgZone(7, '220,95 210,110 230,195 242,185')}
                  {renderSvgZone(9, '242,185 230,195 255,275 268,265')}
                  {renderSvgZone(11, '', 'path', 'M 268 265 L 255 275 L 275 320 L 290 300 Z')}

                  {/* Right Leg */}
                  {renderSvgZone(17, '115,230 160,265 155,380 115,380')}
                  {renderSvgZone(49, '115,380 155,380 155,410 115,410')}
                  {renderSvgZone(19, '115,410 155,410 150,520 115,520')}
                  {renderSvgZone(21, '', 'path', 'M 115 520 L 150 520 L 155 560 L 105 560 Z')}

                  {/* Left Leg */}
                  {renderSvgZone(18, '160,265 205,230 205,380 165,380')}
                  {renderSvgZone(50, '165,380 205,380 205,410 165,410')}
                  {renderSvgZone(20, '165,410 205,410 205,520 170,520')}
                  {renderSvgZone(22, '', 'path', 'M 170 520 L 205 520 L 215 560 L 165 560 Z')}

                  {/* Text numbers */}
                  <g fill="var(--text-primary)" fontSize="11" fontWeight="700" pointerEvents="none" textAnchor="middle">
                    <text x="146" y="52">1</text>
                    <text x="174" y="52">2</text>
                    <text x="160" y="80">3</text>
                    <text x="122" y="103">4</text>
                    <text x="198" y="103">5</text>
                    <text x="135" y="140">12</text>
                    <text x="185" y="140">13</text>
                    <text x="135" y="200">14</text>
                    <text x="185" y="200">15</text>
                    <text x="160" y="248">16</text>
                    
                    <text x="94" y="142">6</text>
                    <text x="76" y="228">8</text>
                    <text x="48" y="295">10</text>
                    
                    <text x="226" y="142">7</text>
                    <text x="244" y="228">9</text>
                    <text x="272" y="295">11</text>
                    
                    <text x="135" y="320">17</text>
                    <text x="135" y="398">49</text>
                    <text x="135" y="468">19</text>
                    <text x="130" y="542">21</text>
                    
                    <text x="185" y="320">18</text>
                    <text x="185" y="398">50</text>
                    <text x="185" y="468">20</text>
                    <text x="190" y="542">22</text>
                  </g>
                </svg>
              </div>
            </div>

            {/* Back View Panel */}
            <div className="body-map-panel" style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px', background: 'rgba(255, 255, 255, 0.4)', borderRadius: '20px', border: '1px solid var(--border-color)', maxWidth: '340px' }}>
              <span style={{ fontWeight: '800', fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '1.5px', marginBottom: '16px' }}>Back View</span>
              <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
                <svg width="100%" height="auto" viewBox="0 0 320 600" className="select-none" style={{ maxWidth: '300px', maxHeight: '560px' }}>
                  <g opacity="0.1">
                    <circle cx="160" cy="65" r="32" fill="var(--text-primary)" />
                    <rect x="145" y="85" width="30" height="25" rx="4" fill="var(--text-primary)" />
                    <rect x="110" y="110" width="100" height="150" rx="16" fill="var(--text-primary)" />
                  </g>

                  {/* Render Back Hotspots */}
                  {/* Head Back Left/Right */}
                  {renderSvgZone(23, '', 'path', 'M 160 30 A 30 35 0 0 0 130 65 L 160 65 Z')}
                  {renderSvgZone(24, '', 'path', 'M 160 30 A 30 35 0 0 1 190 65 L 160 65 Z')}
                  {/* Neck */}
                  {renderSvgZone(25, '148,65 172,65 175,90 145,90')}
                  {/* Shoulders */}
                  {renderSvgZone(26, '145,90 145,110 95,120 100,95')}
                  {renderSvgZone(27, '175,90 175,110 225,120 220,95')}
                  {/* Upper Back */}
                  {renderSvgZone(34, '110,110 160,110 160,170 110,170')}
                  {renderSvgZone(35, '160,110 210,110 210,170 160,170')}
                  {/* Lower Back */}
                  {renderSvgZone(36, '110,170 160,170 160,225 115,225')}
                  {renderSvgZone(37, '160,170 210,170 205,225 160,225')}
                  {/* Spine / Sacrum */}
                  {renderSvgZone(46, '145,225 175,225 180,245 140,245')}
                  {/* Buttocks */}
                  {renderSvgZone(38, '115,245 160,245 160,278 115,278')}
                  {renderSvgZone(39, '160,245 205,245 205,278 160,278')}
                  
                  {/* Arm Backs */}
                  {renderSvgZone(28, '100,95 110,110 90,195 78,185')}
                  {renderSvgZone(30, '78,185 90,195 65,275 52,265')}
                  {renderSvgZone(32, '', 'path', 'M 52 265 L 65 275 L 45 320 L 30 300 Z')}

                  {renderSvgZone(29, '220,95 210,110 230,195 242,185')}
                  {renderSvgZone(31, '242,185 230,195 255,275 268,265')}
                  {renderSvgZone(33, '', 'path', 'M 268 265 L 255 275 L 275 320 L 290 300 Z')}

                  {/* Leg Backs */}
                  {renderSvgZone(40, '115,278 160,278 155,380 115,380')}
                  {renderSvgZone(41, '160,278 205,278 205,380 165,380')}
                  {renderSvgZone(42, '115,380 155,380 150,490 115,490')}
                  {renderSvgZone(43, '165,380 205,380 205,490 170,490')}
                  
                  {/* Ankles */}
                  {renderSvgZone(47, '115,490 150,490 150,520 115,520')}
                  {renderSvgZone(48, '170,490 205,490 205,520 170,520')}
                  
                  {/* Feet Backs */}
                  {renderSvgZone(44, '', 'path', 'M 115 520 L 150 520 L 140 560 L 105 550 Z')}
                  {renderSvgZone(45, '', 'path', 'M 170 520 L 205 520 L 215 550 L 180 560 Z')}

                  {/* Text numbers */}
                  <g fill="var(--text-primary)" fontSize="11" fontWeight="700" pointerEvents="none" textAnchor="middle">
                    <text x="146" y="52">23</text>
                    <text x="174" y="52">24</text>
                    <text x="160" y="80">25</text>
                    <text x="122" y="103">26</text>
                    <text x="198" y="103">27</text>
                    <text x="135" y="140">34</text>
                    <text x="185" y="140">35</text>
                    <text x="135" y="200">36</text>
                    <text x="185" y="200">37</text>
                    <text x="160" y="238">46</text>
                    <text x="138" y="265">38</text>
                    <text x="182" y="265">39</text>
                    
                    <text x="94" y="142">28</text>
                    <text x="76" y="228">30</text>
                    <text x="48" y="295">32</text>
                    
                    <text x="226" y="142">29</text>
                    <text x="244" y="228">31</text>
                    <text x="272" y="295">33</text>
                    
                    <text x="135" y="325">40</text>
                    <text x="135" y="440">42</text>
                    <text x="132" y="508">47</text>
                    <text x="128" y="545">44</text>
                    
                    <text x="185" y="325">41</text>
                    <text x="185" y="440">43</text>
                    <text x="188" y="508">48</text>
                    <text x="192" y="545">45</text>
                  </g>
                </svg>
              </div>
            </div>

          </div>

          {/* Tooltip Hover Overlay Info */}
          <div style={{ height: '24px', textAlign: 'center', fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '24px' }}>
            {hoveredRegion ? `Hovering over: ${ZONE_NAMES[hoveredRegion]}` : "Hover over a region to identify it"}
          </div>

          {/* Selection summary bar */}
          <div style={{ padding: '16px 20px', background: 'rgba(29, 158, 117, 0.05)', border: '1px solid rgba(29, 158, 117, 0.15)', borderRadius: '16px', marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.92rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
              {selectedRegions.length > 0 ? (
                <span>
                  <strong>Selected regions:</strong> {selectedRegions.map(id => ZONE_NAMES[id].split(' (')[0]).join(', ')} ({selectedRegions.length} zone{selectedRegions.length > 1 ? 's' : ''})
                </span>
              ) : (
                <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No regions selected. Please click on the diagram to choose regions.</span>
              )}
            </span>
            {selectedRegions.length > 0 && (
              <button 
                onClick={() => setSelectedRegions([])} 
                style={{ background: 'none', border: 'none', color: '#EF4444', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer', outline: 'none' }}
              >
                Clear All
              </button>
            )}
          </div>

          {/* Actions Bottom Bar */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
            <button
              onClick={() => setStep(2)}
              disabled={selectedRegions.length === 0}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: selectedRegions.length === 0 ? 0.5 : 1 }}
            >
              Next <FiChevronRight />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: DETAILS & SYMPTOMS FORM */}
      {step === 2 && (
        <div className="animate-fade-in">
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.9rem' }}>
            For each of your selected areas, please grade the severity, specify the duration of pain, and provide a short description.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '32px' }}>
            {selectedRegions.map((id) => (
              <div 
                key={id}
                className="glass-card"
                style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-glass)' }}
              >
                {/* Card Title */}
                <h3 className="heading-sm" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '20px' }}>
                  <span style={{ color: 'var(--primary-dark)', fontWeight: '700' }}>{ZONE_NAMES[id]}</span>
                  <span className="badge badge-primary" style={{ textTransform: 'none', fontSize: '0.75rem' }}>Zone {id}</span>
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                  {/* Grid of Severity & Duration */}
                  <div style={{ display: 'flex', flexDirection: 'row', gap: '24px', flexWrap: 'wrap' }}>
                    
                    {/* Pain Severity Rating Selection */}
                    <div style={{ flex: '2 1 300px' }}>
                      <label className="form-label" style={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.5px', fontWeight: '700' }}>Pain Severity</label>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '12px 0' }}>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                          const isSelected = (symptomDetails[id]?.severity || 5) === num;
                          return (
                            <button
                              key={num}
                              type="button"
                              onClick={() => handleDetailChange(id, 'severity', num)}
                              style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '8px',
                                border: isSelected ? 'none' : '1px solid var(--border-color)',
                                background: isSelected ? 'linear-gradient(135deg, var(--primary), var(--primary-dark))' : 'var(--bg-secondary)',
                                color: isSelected ? 'white' : 'var(--text-primary)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: '700',
                                fontSize: '0.9rem',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              {num}
                            </button>
                          );
                        })}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)' }}>
                        <span>1 (Mild discomfort)</span>
                        <span>10 (Severe / Intolerable)</span>
                      </div>
                    </div>

                    {/* Pain Duration Dropdown */}
                    <div style={{ flex: '1 1 200px' }}>
                      <label className="form-label" style={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.5px', fontWeight: '700' }}>Duration</label>
                      <select
                        value={symptomDetails[id]?.duration || '1-3 days'}
                        onChange={(e) => handleDetailChange(id, 'duration', e.target.value)}
                        className="form-input"
                        style={{ width: '100%', marginTop: '8px', cursor: 'pointer' }}
                      >
                        <option value="Less than 24 hours">Less than 24 hours</option>
                        <option value="1-3 days">1-3 days</option>
                        <option value="4-7 days">4-7 days</option>
                        <option value="Chronic / 1+ weeks">Chronic / 1+ weeks</option>
                      </select>
                    </div>

                  </div>
                </div>

                {/* Description Text Box */}
                <div style={{ marginTop: '20px' }}>
                  <label className="form-label" style={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.5px', fontWeight: '700' }}>Description</label>
                  <textarea
                    value={symptomDetails[id]?.description || ''}
                    onChange={(e) => handleDetailChange(id, 'description', e.target.value)}
                    placeholder="Describe the type of pain (throbbing, sharp, dull, stabbing)..."
                    className="form-input"
                    style={{ width: '100%', height: '90px', resize: 'vertical', marginTop: '8px' }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Current Medication Conditional Section */}
          <div className="glass-card" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'rgba(29, 158, 117, 0.01)', marginBottom: '32px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={onMedication}
                onChange={(e) => setOnMedication(e.target.checked)}
                style={{ width: '20px', height: '20px', accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
              <span style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '0.95rem' }}>Are you on any current medication?</span>
            </label>

            {/* Smooth transition uploader */}
            <AnimatePresence>
              {onMedication && (
                <motion.div
                  initial={{ height: 0, opacity: 0, marginTop: 0 }}
                  animate={{ height: 'auto', opacity: 1, marginTop: 24 }}
                  exit={{ height: 0, opacity: 0, marginTop: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '20px' }}
                >
                  <div>
                    <label className="form-label" style={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.5px', fontWeight: '700' }}>Prescription / Medication Details</label>
                    <textarea
                      value={prescriptionDetails}
                      onChange={(e) => setPrescriptionDetails(e.target.value)}
                      placeholder="List the names, dosages, and frequency of your current medications..."
                      className="form-input"
                      style={{ width: '100%', height: '80px', resize: 'vertical', marginTop: '8px', background: 'var(--bg-primary)' }}
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.5px', fontWeight: '700' }}>Upload Photo of Prescription</label>
                    
                    {prescriptionImage ? (
                      <div style={{ position: 'relative', display: 'inline-block', marginTop: '12px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                        <img 
                          src={prescriptionImage} 
                          alt="Prescription Preview" 
                          style={{ maxHeight: '180px', objectFit: 'contain', background: '#white', display: 'block' }}
                        />
                        <button
                          type="button"
                          onClick={() => setPrescriptionImage('')}
                          style={{
                            position: 'absolute',
                            top: '10px',
                            right: '10px',
                            background: '#EF4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '50%',
                            width: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            boxShadow: 'var(--shadow-sm)',
                            transition: 'all 0.2s'
                          }}
                          title="Remove prescription image"
                        >
                          <FiTrash2 size={15} />
                        </button>
                      </div>
                    ) : (
                      <div
                        onDragOver={onDragOver}
                        onDrop={onDrop}
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          border: '2px dashed var(--primary)',
                          borderRadius: '16px',
                          padding: '32px 24px',
                          textAlign: 'center',
                          background: 'var(--bg-primary)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '12px',
                          marginTop: '8px',
                          transition: 'all 0.2s'
                        }}
                      >
                        <FiUploadCloud size={36} style={{ color: 'var(--text-muted)' }} />
                        {uploadingImage ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                            <div className="spinner" style={{ width: '16px', height: '16px' }}></div> Uploading...
                          </div>
                        ) : (
                          <>
                            <span style={{ fontWeight: '700', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Drag & drop your prescription image here</span>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>or click to browse from device (JPG/PNG)</span>
                          </>
                        )}
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={(e) => handleFileUpload(e.target.files?.[0])}
                          style={{ display: 'none' }}
                          accept="image/*"
                        />
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
            <button
              onClick={() => setStep(1)}
              className="btn btn-outline"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <FiChevronLeft /> Back
            </button>

            <button
              onClick={handleFormSubmit}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              Submit Analysis <FiCheckCircle />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: MEDGAMMA4B RESPONSE */}
      {step === 3 && (
        <div className="animate-fade-in">
          
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', gap: '20px' }}>
              <div style={{ position: 'relative', width: '64px', height: '64px' }}>
                <div style={{ width: '100%', height: '100%', borderRadius: '50%', border: '4px solid var(--bg-secondary)', borderTopColor: 'var(--primary)', animation: 'rotate 1s linear infinite' }}></div>
                <FiCpu style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'var(--primary)' }} size={24} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <h3 className="heading-sm" style={{ margin: '0 0 6px 0' }}>Consulting MedGamma4b Engine...</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', animation: 'pulse 1.5s infinite' }}>Analyzing symptom severity, duration, and context for home care remedies.</p>
              </div>
            </div>
          ) : (
            <div>
              {/* Analysis Inference Details Banner */}
              <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'rgba(29, 158, 117, 0.03)', border: '1px solid var(--border-color)', borderRadius: '16px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ padding: '8px', background: 'rgba(29, 158, 117, 0.1)', color: 'var(--primary)', borderRadius: '8px' }}>
                    <FiActivity size={18} />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block' }}>Inference Core Engine</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)' }}>{aiModelUsed ? aiModelUsed.replace('SiddharthMedX', 'Astra AI') : ''}</span>
                  </div>
                </div>
              </div>

              {/* Analysis Output Container */}
              <div className="glass-card" style={{ padding: '28px', border: '1px solid var(--border-color)', borderRadius: '16px', background: 'var(--bg-glass)', marginBottom: '32px', maxHeight: '60vh', overflowY: 'auto', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.02)' }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  {parseMarkdownResponse(analysisResult)}
                </div>
              </div>

              {/* Actions Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <button
                  onClick={() => {
                    setStep(1);
                    setSelectedRegions([]);
                    setSymptomDetails({});
                    setOnMedication(false);
                    setPrescriptionDetails('');
                    setPrescriptionImage('');
                    setAnalysisResult('');
                  }}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <FiActivity /> Start New Analysis
                </button>
              </div>

            </div>
          )}

        </div>
      )}

    </div>
  );
}
