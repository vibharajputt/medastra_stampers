import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiUpload, FiX, FiCheck, FiCpu, FiPlus, FiAlertCircle } from 'react-icons/fi';
import { fileAPI, aiAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function SkinCareAssessment() {
  const [symptoms, setSymptoms] = useState('');
  const [images, setImages] = useState([]); // Array of File objects
  const [previews, setPreviews] = useState([]); // Array of string data URLs or object URLs
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(''); // 'Uploading images...', 'Analyzing with AI...'
  const [assessment, setAssessment] = useState(null); // The generated markdown report
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Handle files selected via file input or drag-and-drop
  const handleFiles = (fileList) => {
    const validFiles = [];
    const validPreviews = [];

    Array.from(fileList).forEach(file => {
      if (file.type.startsWith('image/')) {
        validFiles.push(file);
        validPreviews.push(URL.createObjectURL(file));
      } else {
        toast.error(`${file.name} is not a valid image file.`);
      }
    });

    setImages(prev => [...prev, ...validFiles]);
    setPreviews(prev => [...prev, ...validPreviews]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    // Revoke the object URL to avoid memory leaks
    URL.revokeObjectURL(previews[index]);
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let uploadedUrls = [];
      if (images.length > 0) {
        setLoadingStep('Uploading skin images...');
        const uploadPromises = images.map(file => fileAPI.upload(file));
        const responses = await Promise.all(uploadPromises);
        uploadedUrls = responses.map(res => {
          if (res.data && res.data.success) {
            return res.data.message; // Relative URL returned in message
          }
          throw new Error('Image upload failed');
        });
      }

      setLoadingStep('Analyzing symptoms with Astra AI...');
      const res = await aiAPI.assessSkinCare({
        symptoms,
        images: uploadedUrls
      });

      if (res.data && res.data.success) {
        setAssessment(res.data.assessment);
        toast.success('Skin assessment complete!');
      } else {
        toast.error('Failed to analyze skin symptoms.');
      }
    } catch (err) {
      console.error(err);
      toast.error('An error occurred during assessment. Check if backend is running.');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  const handleReset = () => {
    setSymptoms('');
    setImages([]);
    previews.forEach(url => URL.revokeObjectURL(url));
    setPreviews([]);
    setAssessment(null);
  };

  // Helper to render markdown-like assessment sections
  const renderAssessmentSection = (headerTitle, contentHtml) => {
    return (
      <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
        <h4 style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FiCpu /> {headerTitle}
        </h4>
        <div
          className="skin-assessment-markdown"
          style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />
      </div>
    );
  };

  const parseAssessment = (markdownText) => {
    if (!markdownText) return { causes: '', remedies: '', nextSteps: '', disclaimer: '' };

    // Split content by our headers
    const causesHeader = '### Potential Causes';
    const remediesHeader = '### Possible Remedies';
    const nextStepsHeader = '### Recommendations / Next Steps';

    let causes = '';
    let remedies = '';
    let nextSteps = '';
    let disclaimer = '';

    const causesIndex = markdownText.indexOf(causesHeader);
    const remediesIndex = markdownText.indexOf(remediesHeader);
    const nextStepsIndex = markdownText.indexOf(nextStepsHeader);

    // Parse Causes
    if (causesIndex !== -1) {
      const endIdx = remediesIndex !== -1 ? remediesIndex : (nextStepsIndex !== -1 ? nextStepsIndex : markdownText.length);
      causes = markdownText.substring(causesIndex + causesHeader.length, endIdx).trim();
    }

    // Parse Remedies
    if (remediesIndex !== -1) {
      const endIdx = nextStepsIndex !== -1 ? nextStepsIndex : markdownText.length;
      remedies = markdownText.substring(remediesIndex + remediesHeader.length, endIdx).trim();
    }

    // Parse Next Steps
    if (nextStepsIndex !== -1) {
      nextSteps = markdownText.substring(nextStepsIndex + nextStepsHeader.length).trim();
      // If disclaimer is present at the bottom, separate it
      const disclaimerIndex = nextSteps.indexOf('*(Disclaimer:');
      if (disclaimerIndex !== -1) {
        disclaimer = nextSteps.substring(disclaimerIndex).trim();
        nextSteps = nextSteps.substring(0, disclaimerIndex).trim();
      }
    }

    // Convert markdown list items/bold text to HTML
    const toHtml = (text) => {
      if (!text) return '';
      return text
        .replace(/\n\n/g, '<br/><br/>')
        .replace(/\n- /g, '<br/>• ')
        .replace(/\n\* /g, '<br/>• ')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
    };

    return {
      causes: toHtml(causes),
      remedies: toHtml(remedies),
      nextSteps: toHtml(nextSteps),
      disclaimer: toHtml(disclaimer)
    };
  };

  const parsed = parseAssessment(assessment);

  return (
    <div className="glass-card animate-fade-in" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative' }}>
      <AnimatePresence mode="wait">
        {!assessment ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
          >
            <div>
              <h2 className="heading-md" style={{ color: 'var(--text-primary)', margin: 0 }}>AI Skin Care Assessment</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '6px', lineHeight: 1.5 }}>
                Describe your skin symptoms, upload photos, or do both to get an immediate AI-powered preliminary analysis.
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Textarea */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Describe your symptoms (optional)
                </label>
                <textarea
                  className="form-input"
                  rows={4}
                  placeholder="e.g., Red itchy rash on my left forearm for 2 days, feels dry..."
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  style={{
                    borderRadius: '12px',
                    padding: '14px 18px',
                    fontSize: '0.95rem',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    resize: 'vertical',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    width: '100%',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              {/* Upload Zone */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Upload Skin Images (optional)
                </label>

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={triggerFileInput}
                  style={{
                    border: isDragOver ? '2px dashed var(--primary)' : '2px dashed var(--border-color)',
                    background: isDragOver ? 'rgba(0, 217, 166, 0.04)' : 'rgba(255,255,255,0.01)',
                    borderRadius: '12px',
                    padding: '32px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px'
                  }}
                  onMouseEnter={(e) => {
                    if (!isDragOver) {
                      e.currentTarget.style.borderColor = 'var(--primary)';
                      e.currentTarget.style.background = 'rgba(0, 217, 166, 0.02)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isDragOver) {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.background = 'rgba(255,255,255,0.01)';
                    }
                  }}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => handleFiles(e.target.files)}
                    multiple
                    accept="image/*"
                    style={{ display: 'none' }}
                  />
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: 'rgba(0, 217, 166, 0.1)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.4rem'
                  }}>
                    <FiUpload />
                  </div>
                  <div>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'block', fontSize: '0.95rem' }}>
                      Drag & drop skin images here or click to browse
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
                      Supports JPEG, PNG, WEBP (Multiple files allowed)
                    </span>
                  </div>
                </div>

                {/* Previews */}
                {previews.length > 0 && (
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '12px',
                    marginTop: '16px',
                    padding: '8px',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)'
                  }}>
                    {previews.map((url, idx) => (
                      <div
                        key={idx}
                        style={{
                          width: '90px',
                          height: '90px',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          position: 'relative',
                          border: '1px solid var(--border-color)',
                          boxShadow: 'var(--shadow-sm)'
                        }}
                      >
                        <img
                          src={url}
                          alt={`Skin thumbnail ${idx + 1}`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeImage(idx);
                          }}
                          style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            background: 'rgba(0,0,0,0.6)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '50%',
                            width: '20px',
                            height: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            transition: 'background-color 0.15s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.6)'}
                        >
                          <FiX />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                  style={{
                    padding: '12px 32px',
                    fontSize: '1rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    minWidth: '120px',
                    justifyContent: 'center'
                  }}
                >
                  {loading ? (
                    <>
                      <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      Next <FiPlus size={16} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        ) : (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 className="heading-md" style={{ color: 'var(--text-primary)', margin: 0 }}>AI Skin Care Assessment Report</h2>
                <button
                  onClick={handleReset}
                  className="btn btn-outline btn-sm"
                  style={{ padding: '8px 16px', borderRadius: 'var(--radius-full)' }}
                >
                  Start New Assessment
                </button>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '6px' }}>
                Preliminary evaluation based on reported symptoms and uploaded media.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {parsed.causes && renderAssessmentSection('Potential Causes', parsed.causes)}
              {parsed.remedies && renderAssessmentSection('Possible Remedies', parsed.remedies)}
              {parsed.nextSteps && renderAssessmentSection('Recommendations / Next Steps', parsed.nextSteps)}

              {parsed.disclaimer && (
                <div style={{
                  marginTop: '12px',
                  padding: '16px',
                  background: 'rgba(239, 68, 68, 0.02)',
                  border: '1px solid rgba(239, 68, 68, 0.15)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  color: 'var(--text-secondary)',
                  fontSize: '0.82rem',
                  lineHeight: 1.5
                }}>
                  <FiAlertCircle size={20} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                  <div dangerouslySetInnerHTML={{ __html: parsed.disclaimer }} />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Overlay */}
      {loading && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(3px)',
          borderRadius: 'inherit',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          zIndex: 10
        }}>
          <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '3px' }}></div>
          <div style={{ color: 'white', fontWeight: 600, fontSize: '1rem' }}>{loadingStep}</div>
        </div>
      )}
    </div>
  );
}
