'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/translations/LanguageContext';
import './dashboard.css';

export default function Dashboard() {
  const router = useRouter();
  const { t } = useLanguage();
  
  const [user, setUser] = useState(null);
  const [screens, setScreens] = useState([]);
  const [selectedScreen, setSelectedScreen] = useState(null);
  const [contents, setContents] = useState([]);
  
  // Screen form state
  const [screenName, setScreenName] = useState('');
  const [screenLocation, setScreenLocation] = useState('');
  const [screenSlug, setScreenSlug] = useState('');
  
  // Content upload form state
  const [contentTitle, setContentTitle] = useState('');
  const [contentType, setContentType] = useState('A-Basic'); // A-Basic, B-Advanced
  const [mediaType, setMediaType] = useState('image'); // image, video, widget_clock, widget_announcement, widget_url
  const [duration, setDuration] = useState(10);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [widgetText, setWidgetText] = useState('');
  const [widgetUrl, setWidgetUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  
  // Live Signage Simulator state
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // Trial Warnings state
  const [showFirstWarn, setShowFirstWarn] = useState(false);
  const [showNearExpiry, setShowNearExpiry] = useState(false);
  
  // Custom Confirm modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');
  const [onConfirmCallback, setOnConfirmCallback] = useState(null);
  const [confirmBtnLabel, setConfirmBtnLabel] = useState('');

  // Function to show custom inline platform confirm dialog
  const showCustomConfirm = (title, message, callback, btnLabel = "نعم، احذف") => {
    setConfirmTitle(title);
    setConfirmMessage(message);
    setOnConfirmCallback(() => () => {
      callback();
      setConfirmOpen(false);
    });
    setConfirmBtnLabel(btnLabel);
    setConfirmOpen(true);
  };

  // Verify auth on mount
  useEffect(() => {
    async function loadDashboard() {
      try {
        const res = await fetch('/api/auth/status');
        if (!res.ok) {
          router.push('/login');
          return;
        }
        
        const data = await res.json();
        if (!data.authenticated) {
          router.push('/login');
          return;
        }
        
        setUser(data.user);
        
        // Fetch screens
        await fetchScreens();
        
        setLoading(false);
      } catch (err) {
        console.error(err);
        router.push('/login');
      }
    }
    loadDashboard();
  }, [router]);

  // Handle trial alerts & tickers
  useEffect(() => {
    if (user && user.role !== 'admin') {
      // 1. Show first time alert popup if not shown yet
      const firstWarnShown = localStorage.getItem('smartscreen_first_warn_shown');
      if (!firstWarnShown) {
        setShowFirstWarn(true);
      }
      
      // 2. Set up interval to check near-expiry (less than 10 mins remaining)
      const checkNearExpiry = () => {
        const expiry = new Date(user.expiry_date);
        const now = new Date();
        const diffMs = expiry - now;
        
        // 10 minutes is 10 * 60 * 1000 = 600,000 ms
        if (diffMs > 0 && diffMs <= 10 * 60 * 1000) {
          const nearExpiryShown = localStorage.getItem('smartscreen_near_expiry_shown');
          if (!nearExpiryShown) {
            setShowNearExpiry(true);
          }
        }
      };
      
      // Run once immediately, then every 10 seconds
      checkNearExpiry();
      const interval = setInterval(checkNearExpiry, 10000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Handle slide rotation for the Live Preview Simulator
  useEffect(() => {
    if (contents.length === 0) {
      setActiveSlideIndex(0);
      return;
    }
    
    // Filter contents that are active right now based on schedule
    const getScheduledSlides = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMin = now.getMinutes();
      const nowTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
      
      return contents.filter(slide => {
        if (!slide.start_time || !slide.end_time) return true;
        return nowTimeStr >= slide.start_time && nowTimeStr <= slide.end_time;
      });
    };
    
    const activeSlides = getScheduledSlides();
    if (activeSlides.length === 0) {
      setActiveSlideIndex(-1); // Show offline screen
      return;
    }
    
    // Make sure index is in bounds
    let idx = activeSlideIndex;
    if (idx >= activeSlides.length || idx < 0) {
      idx = 0;
      setActiveSlideIndex(0);
      return;
    }
    
    const currentSlide = activeSlides[idx];
    const slideDuration = (currentSlide.duration || 10) * 1000;
    
    const timer = setTimeout(() => {
      setActiveSlideIndex((prev) => {
        const nextIdx = (prev + 1) % activeSlides.length;
        return nextIdx;
      });
    }, slideDuration);
    
    return () => clearTimeout(timer);
  }, [contents, activeSlideIndex]);

  const fetchScreens = async () => {
    const res = await fetch('/api/screens');
    if (res.ok) {
      const data = await res.json();
      setScreens(data.screens || []);
      
      // Update selected screen details if it is currently loaded
      if (selectedScreen) {
        const updated = data.screens.find(s => s.id === selectedScreen.id);
        if (updated) setSelectedScreen(updated);
      }
    }
  };

  const fetchContents = async (screenId) => {
    const res = await fetch(`/api/contents?screenId=${screenId}`);
    if (res.ok) {
      const data = await res.json();
      setContents(data.contents || []);
      setActiveSlideIndex(0);
    } else {
      setContents([]);
    }
  };

  const handleSelectScreen = (screen) => {
    setSelectedScreen(screen);
    fetchContents(screen.id);
    setError('');
  };

  const handleAddScreen = async (e) => {
    e.preventDefault();
    setError('');
    setActionLoading(true);
    
    try {
      const res = await fetch('/api/screens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: screenName,
          location: screenLocation,
          slug: screenSlug
        })
      });
      
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'slug_exists') {
          setError(t.screenSlugLabel + ' ' + t.statusBlocked);
        } else {
          setError('Failed to create screen.');
        }
        setActionLoading(false);
        return;
      }
      
      setScreenName('');
      setScreenLocation('');
      setScreenSlug('');
      await fetchScreens();
      setActionLoading(false);
    } catch (err) {
      console.error(err);
      setError('An error occurred.');
      setActionLoading(false);
    }
  };

  const handleDeleteScreen = async (screenId, e) => {
    e.stopPropagation();
    showCustomConfirm(
      "حذف شاشة العرض",
      t.deleteScreenConfirm,
      async () => {
        try {
          const res = await fetch(`/api/screens/${screenId}`, { method: 'DELETE' });
          if (res.ok) {
            if (selectedScreen && selectedScreen.id === screenId) {
              setSelectedScreen(null);
              setContents([]);
            }
            await fetchScreens();
          }
        } catch (err) {
          console.error(err);
        }
      }
    );
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragOver(true);
    } else if (e.type === "dragleave") {
      setDragOver(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      handleFileSelection(file);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const handleFileSelection = (file) => {
    if (file.size > 10 * 1024 * 1024) {
      alert("File size exceeds 10MB limit.");
      return;
    }
    setSelectedFile(file);
    setContentTitle(file.name.split('.').slice(0, -1).join('.'));
    
    if (file.type.startsWith('video/')) {
      setMediaType('video');
    } else {
      setMediaType('image');
    }
  };

  const handleAddContent = async (e) => {
    e.preventDefault();
    if (!selectedScreen) return;
    
    setError('');
    setActionLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('screenId', selectedScreen.id);
      formData.append('title', contentTitle);
      formData.append('type', contentType);
      formData.append('duration', duration);
      formData.append('startTime', startTime);
      formData.append('endTime', endTime);
      
      if (contentType === 'A-Basic') {
        if (!selectedFile) {
          setError('Please select a media file to upload.');
          setActionLoading(false);
          return;
        }
        formData.append('file', selectedFile);
        formData.append('mediaType', mediaType);
      } else {
        formData.append('mediaType', mediaType);
        formData.append('widgetText', widgetText);
        formData.append('widgetUrl', widgetUrl);
      }
      
      const res = await fetch('/api/contents', {
        method: 'POST',
        body: formData
      });
      
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to upload content.');
        setActionLoading(false);
        return;
      }
      
      // Reset form
      setContentTitle('');
      setSelectedFile(null);
      setWidgetText('');
      setWidgetUrl('');
      setStartTime('');
      setEndTime('');
      setDuration(10);
      
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      await fetchContents(selectedScreen.id);
      await fetchScreens(); // Update counts
      setActionLoading(false);
    } catch (err) {
      console.error(err);
      setError('An error occurred.');
      setActionLoading(false);
    }
  };

  const handleDeleteContent = async (contentId) => {
    showCustomConfirm(
      "حذف الشريحة",
      "هل أنت متأكد من رغبتك في حذف هذه الشريحة من قائمة التشغيل؟",
      async () => {
        try {
          const res = await fetch(`/api/contents/${contentId}`, { method: 'DELETE' });
          if (res.ok) {
            await fetchContents(selectedScreen.id);
            await fetchScreens(); // Update counts
          }
        } catch (err) {
          console.error(err);
        }
      }
    );
  };

  const handleLogout = async () => {
    const res = await fetch('/api/auth/logout', { method: 'POST' });
    if (res.ok) {
      router.push('/login');
    }
  };

  // Get active scheduled slides for simulation rendering
  const getScheduledSlidesList = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const nowTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
    
    return contents.filter(slide => {
      if (!slide.start_time || !slide.end_time) return true;
      return nowTimeStr >= slide.start_time && nowTimeStr <= slide.end_time;
    });
  };

  const activeSlides = getScheduledSlidesList();
  const currentSlide = activeSlides[activeSlideIndex] || null;

  if (loading) {
    return (
      <div className="login-page">
        <div style={{
          border: '3px solid rgba(11, 34, 64, 0.1)',
          borderTopColor: '#0b2240',
          borderRadius: '50%',
          width: '36px',
          height: '36px',
          animation: 'spin 0.8s linear infinite',
          marginBottom: '1rem'
        }} />
        <p>{t.loading}</p>
      </div>
    );
  }

  // 24 Hour Trial Locked Screen
  if (user && user.expired) {
    // Generate WhatsApp link
    const waText = encodeURIComponent(`Hello, I would like to extend/activate my SmartScreen subscription. (Number: +966${user.phone})`);
    const whatsappLink = `https://wa.me/966555252341?text=${waText}`;
    
    return (
      <div className="expiry-lock-overlay">
        <div className="lock-card">
          <div className="lock-icon">🔒</div>
          <h2>{t.accessDeniedTitle}</h2>
          <p>{t.trialWarningText}</p>
          <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="btn btn-accent" style={{ padding: '0.8rem 1.5rem', display: 'inline-flex', textDecoration: 'none' }}>
            💬 {t.contactWhatsApp}
          </a>
          <button onClick={handleLogout} className="btn btn-secondary" style={{ display: 'block', margin: '1.5rem auto 0 auto' }}>
            {t.navLogout}
          </button>
        </div>
      </div>
    );
  }

  // Generate WhatsApp contact link for warning bar
  const waTextText = encodeURIComponent(`Hello, I want to upgrade my trial subscription. (Number: +966${user?.phone})`);
  const headerWhatsappLink = `https://wa.me/966555252341?text=${waTextText}`;

  // Calculate live displays count & slides count
  const totalScreensRegistered = screens.length;
  const totalUploadedSlides = screens.reduce((acc, curr) => acc + (curr.slidesCount || 0), 0);

  return (
    <div className="dashboard-wrapper">
      {/* 24h Warning Banner */}
      {user && user.role !== 'admin' && (
        <div className="trial-warning-banner">
          <span>⚠️ {t.trialWarningText}</span>
          <a href={headerWhatsappLink} target="_blank" rel="noopener noreferrer" className="btn-whatsapp">
            💬 WhatsApp
          </a>
        </div>
      )}
      
      {/* Main Header */}
      <header className="dashboard-header">
        <div className="header-brand">
          <div className="logo">SS</div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{t.appName}</h1>
        </div>
        
        <div className="header-user-info">
          {user && (
            <span className="user-tag">
              📞 +966 {user.phone} ({user.role === 'admin' ? t.navAdmin : t.statusActive})
            </span>
          )}
          
          {user && user.role === 'admin' && (
            <button className="btn btn-accent" onClick={() => router.push('/admin')}>
              ⚙️ {t.navAdmin}
            </button>
          )}
          
          <button className="btn btn-danger" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} onClick={handleLogout}>
            🚪 {t.navLogout}
          </button>
        </div>
      </header>
      
      {/* Dashboard Panels */}
      <div className="dashboard-content">
        {/* Left Side: Add Screen & Screens List */}
        <div className="side-panel">
          {/* Add Screen Form */}
          <div className="db-card">
            <h3 className="db-card-title">{t.addScreenTitle}</h3>
            <form onSubmit={handleAddScreen}>
              <div className="form-group">
                <label className="form-label">{t.screenNameLabel}</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder={t.screenNamePlaceholder}
                  value={screenName}
                  onChange={(e) => setScreenName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t.screenSlugLabel}</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder={t.screenSlugPlaceholder}
                  value={screenSlug}
                  onChange={(e) => setScreenSlug(e.target.value)}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.screenSlugHelp}</span>
              </div>
              <div className="form-group">
                <label className="form-label">{t.screenLocationLabel}</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder={t.screenLocationPlaceholder}
                  value={screenLocation}
                  onChange={(e) => setScreenLocation(e.target.value)}
                />
              </div>
              
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={actionLoading}>
                ➕ {t.registerScreenBtn}
              </button>
            </form>
          </div>
          
          {/* Active Screens directory */}
          <div className="db-card" style={{ flex: 1, minHeight: '300px' }}>
            <h3 className="db-card-title">{t.activeScreensTitle}</h3>
            {screens.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>
                {t.noScreens}
              </p>
            ) : (
              <div className="screens-list">
                {screens.map(screen => (
                  <div
                    key={screen.id}
                    className={`screen-item ${selectedScreen && selectedScreen.id === screen.id ? 'active' : ''}`}
                    onClick={() => handleSelectScreen(screen)}
                  >
                    <div className="screen-name">{screen.name}</div>
                    <div className="screen-loc">📍 {screen.location || 'No Location Notes'}</div>
                    <div className="screen-meta">
                      <span>🔗 /screen/{screen.id}</span>
                      <span className="screen-badge-count">{screen.slidesCount || 0} slides</span>
                    </div>
                    
                    <button
                      className="btn btn-danger"
                      style={{
                        position: 'absolute',
                        top: '0.5rem',
                        right: 'auto',
                        left: '0.5rem',
                        padding: '0.2rem 0.4rem',
                        fontSize: '0.7rem'
                      }}
                      onClick={(e) => handleDeleteScreen(screen.id, e)}
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Right Side: Playlist Management Workspace */}
        <div className="main-panel">
          {error && (
            <div className="login-error" style={{ marginBottom: '1.5rem' }}>
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}
          
          {!selectedScreen ? (
            <div className="empty-state">
              <div className="empty-state-icon">🖥️</div>
              <h2>{t.dbTitle}</h2>
              <p style={{ maxWidth: '400px', margin: '0.5rem auto 1.5rem auto' }}>
                {t.dbSubtitle}
              </p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <div className="btn btn-secondary" style={{ cursor: 'default' }}>
                  📺 {t.totalScreens}: {totalScreensRegistered}
                </div>
                <div className="btn btn-secondary" style={{ cursor: 'default' }}>
                  🖼️ {t.totalSlides}: {totalUploadedSlides}
                </div>
              </div>
            </div>
          ) : (
            <div>
              {/* Screen Playlist Header */}
              <div className="playlist-header-block">
                <div>
                  <h2 style={{ color: 'var(--primary-color)', fontSize: '1.4rem', fontWeight: 800 }}>
                    {t.playlistTitle.replace('{name}', selectedScreen.name)}
                  </h2>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    📍 {selectedScreen.location || 'No Location Details'}
                  </p>
                </div>
                
                <div className="playlist-link-box">
                  <span>Signage URL:</span>
                  <code>{`${window.location.origin}/screen/${selectedScreen.id}`}</code>
                  <a href={`/screen/${selectedScreen.id}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                    🔗 {t.liveBtn}
                  </a>
                </div>
              </div>
              
              <div className="playlist-grid">
                {/* Playlist uploads & details forms */}
                <div>
                  <div className="db-card" style={{ boxShadow: 'none', border: '1px solid var(--border-color)' }}>
                    <h3 className="db-card-title">{t.uploadTitle}</h3>
                    
                    <form onSubmit={handleAddContent}>
                      {/* Classification Tab Type A vs Type B */}
                      <label className="form-label">{t.contentTypeLabel}</label>
                      <div className="type-switch-container">
                        <button
                          type="button"
                          className={`type-tab-btn ${contentType === 'A-Basic' ? 'active' : ''}`}
                          onClick={() => {
                            setContentType('A-Basic');
                            setMediaType('image');
                          }}
                        >
                          {t.contentTypeA}
                        </button>
                        <button
                          type="button"
                          className={`type-tab-btn ${contentType === 'B-Advanced' ? 'active' : ''}`}
                          onClick={() => {
                            setContentType('B-Advanced');
                            setMediaType('widget_clock');
                          }}
                        >
                          {t.contentTypeB}
                        </button>
                      </div>
                      
                      {contentType === 'A-Basic' ? (
                        /* Drag & Drop files container */
                        <div
                          className="drop-zone"
                          onDragEnter={handleDrag}
                          onDragOver={handleDrag}
                          onDragLeave={handleDrag}
                          onDrop={handleDrop}
                          onClick={() => fileInputRef.current.click()}
                          style={{
                            borderColor: dragOver ? 'var(--primary-color)' : 'var(--border-color)',
                            backgroundColor: dragOver ? 'rgba(11, 34, 64, 0.04)' : 'var(--card-bg)'
                          }}
                        >
                          <span>📁</span>
                          <p style={{ fontWeight: 600, fontSize: '0.9rem', margin: '0.5rem 0' }}>
                            {selectedFile ? `Selected: ${selectedFile.name}` : t.dragDropText}
                          </p>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.uploadInfo}</span>
                          <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            accept="image/*,video/*"
                            onChange={handleFileChange}
                          />
                        </div>
                      ) : (
                        /* Type B selection dropdown and widget content inputs */
                        <div className="form-group">
                          <label className="form-label">{t.typeBWidgetLabel}</label>
                          <select
                            className="form-control"
                            value={mediaType}
                            onChange={(e) => setMediaType(e.target.value)}
                            style={{ marginBottom: '1rem' }}
                          >
                            <option value="widget_clock">⏰ {t.widgetClock}</option>
                            <option value="widget_announcement">📢 {t.widgetAnnouncement}</option>
                            <option value="widget_url">🌐 {t.widgetUrl}</option>
                          </select>
                          
                          {mediaType === 'widget_announcement' && (
                            <div className="form-group" style={{ animation: 'fadeIn 0.2s ease' }}>
                              <label className="form-label">{t.announcementTextLabel}</label>
                              <textarea
                                className="form-control"
                                rows="3"
                                placeholder={t.announcementTextPlaceholder}
                                value={widgetText}
                                onChange={(e) => setWidgetText(e.target.value)}
                                required
                              />
                            </div>
                          )}
                          
                          {mediaType === 'widget_url' && (
                            <div className="form-group" style={{ animation: 'fadeIn 0.2s ease' }}>
                              <label className="form-label">External Website URL</label>
                              <input
                                type="url"
                                className="form-control"
                                placeholder={t.widgetUrlPlaceholder}
                                value={widgetUrl}
                                onChange={(e) => setWidgetUrl(e.target.value)}
                                required
                              />
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="form-group">
                        <label className="form-label">{t.contentCaptionLabel}</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder={t.contentCaptionPlaceholder}
                          value={contentTitle}
                          onChange={(e) => setContentTitle(e.target.value)}
                        />
                      </div>
                      
                      {/* Grid for duration and hours scheduling */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                          <label className="form-label">{t.durationLabel}</label>
                          <input
                            type="number"
                            className="form-control"
                            min="3"
                            max="3600"
                            value={duration}
                            onChange={(e) => setDuration(parseInt(e.target.value, 10))}
                            required
                          />
                        </div>
                        
                        <div className="form-group">
                          <label className="form-label">{t.startTimeLabel} (HH:MM)</label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="08:00"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                          />
                        </div>
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">{t.endTimeLabel} (HH:MM)</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="17:00"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                        />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.scheduleHelp}</span>
                      </div>
                      
                      <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={actionLoading}>
                        ➕ {t.addToPlaylistBtn}
                      </button>
                    </form>
                  </div>
                </div>
                
                {/* Live Preview Display Simulator panel */}
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--primary-color)' }}>
                    📺 {t.liveStatus}
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    {t.liveStatusSubtitle}
                  </p>
                  
                  <div className="preview-signage-box">
                    <div className="preview-signage-screen">
                      {contents.length === 0 || activeSlideIndex === -1 ? (
                        /* Offline/Empty state placeholder */
                        <div style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                          <span style={{ fontSize: '2.5rem' }}>📺</span>
                          <h4 style={{ color: '#94a3b8', fontSize: '0.95rem', margin: '0.5rem 0' }}>{t.screenOffline}</h4>
                          <p style={{ fontSize: '0.7rem', color: '#475569' }}>{t.screenOfflineSubtitle}</p>
                        </div>
                      ) : (
                        /* Dynamic slide preview */
                        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                          {currentSlide && currentSlide.type === 'A-Basic' && currentSlide.media_type === 'image' && (
                            <img src={currentSlide.url} alt="Signage Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                          )}
                          
                          {currentSlide && currentSlide.type === 'A-Basic' && currentSlide.media_type === 'video' && (
                            <video src={currentSlide.url} autoPlay muted loop style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                          )}
                          
                          {currentSlide && currentSlide.type === 'B-Advanced' && currentSlide.media_type === 'widget_clock' && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '1rem', backgroundColor: '#091d36', color: '#d4af37' }}>
                              <span style={{ fontSize: '2rem' }}>🕒</span>
                              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', margin: '0.5rem 0' }}>10:30 AM</div>
                              <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>Saturday, June 20, 2026</div>
                            </div>
                          )}
                          
                          {currentSlide && currentSlide.type === 'B-Advanced' && currentSlide.media_type === 'widget_announcement' && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '1.5rem', backgroundColor: '#0f172a', border: '2px solid var(--accent-color)', color: '#ffffff', textAlign: 'center' }}>
                              <div>
                                <span style={{ fontSize: '2rem' }}>📢</span>
                                <p style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '1rem' }}>{currentSlide.url}</p>
                              </div>
                            </div>
                          )}
                          
                          {currentSlide && currentSlide.type === 'B-Advanced' && currentSlide.media_type === 'widget_url' && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '1rem', backgroundColor: '#1e293b', textAlign: 'center', color: '#ffffff' }}>
                              <span style={{ fontSize: '2rem' }}>🌐</span>
                              <p style={{ fontSize: '0.8rem', wordBreak: 'break-all', margin: '0.5rem 0' }}>{currentSlide.url}</p>
                              <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>[Website Live View Simulation]</span>
                            </div>
                          )}
                          
                          {/* Top indicator ribbon */}
                          <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            backgroundColor: 'rgba(11, 34, 64, 0.85)',
                            padding: '0.35rem 0.5rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.65rem',
                            color: '#ffffff',
                            borderBottom: '1px solid var(--accent-color)'
                          }}>
                            <span>📺 {selectedScreen.name}</span>
                            <span style={{ color: 'var(--accent-color)', fontWeight: 'bold' }}>
                              {activeSlides.length > 0 ? `${activeSlideIndex + 1} / ${activeSlides.length}` : ''}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Playlist Slides Queue section */}
              <div className="playlist-queue">
                <h3 className="db-card-title">{t.playlistHeader}</h3>
                
                {contents.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: '2rem', border: '1.5px dashed var(--border-color)', borderRadius: '8px', color: 'var(--text-muted)' }}>
                    {t.playlistEmpty}
                  </p>
                ) : (
                  <div className="queue-items">
                    {contents.map((slide, index) => (
                      <div key={slide.id} className="queue-item">
                        {/* Media Preview thumbnail */}
                        <div className="queue-media-preview">
                          {slide.type === 'A-Basic' && slide.media_type === 'image' && (
                            <img src={slide.url} alt="Slide Preview" />
                          )}
                          {slide.type === 'A-Basic' && slide.media_type === 'video' && (
                            <span>🎥</span>
                          )}
                          {slide.type === 'B-Advanced' && slide.media_type === 'widget_clock' && (
                            <span>⏰</span>
                          )}
                          {slide.type === 'B-Advanced' && slide.media_type === 'widget_announcement' && (
                            <span>📢</span>
                          )}
                          {slide.type === 'B-Advanced' && slide.media_type === 'widget_url' && (
                            <span>🌐</span>
                          )}
                        </div>
                        
                        <div className="queue-item-info">
                          <div className="queue-item-title">
                            {slide.title || (slide.type === 'B-Advanced' ? t[slide.media_type.replace('widget_', 'widget')] : 'Untitled Slide')}
                          </div>
                          
                          <div className="queue-item-meta">
                            <span className="badge-type">
                              {slide.type === 'A-Basic' ? 'Type A (Basic)' : 'Type B (Advanced)'}
                            </span>
                            <span>⏱️ {slide.duration}s</span>
                            <span className="badge-time">
                              {slide.start_time && slide.end_time 
                                ? t.scheduledHours.replace('{start}', slide.start_time).replace('{end}', slide.end_time)
                                : t.allDay}
                            </span>
                          </div>
                        </div>
                        
                        <button className="btn btn-danger" onClick={() => handleDeleteContent(slide.id)}>
                          🗑️ {t.delete}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 1. First-time Trial warning modal */}
      {showFirstWarn && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '500px', border: '3px solid var(--accent-color)' }}>
            <div className="modal-header">
              <h3>📢 تنبيه الفترة التجريبية</h3>
            </div>
            <div style={{ margin: '1.5rem 0', lineHeight: '1.6', fontSize: '0.98rem' }}>
              <p>مرحباً بك في <strong>شاشة ذكية (SmartScreen)</strong>!</p>
              <p style={{ marginTop: '0.75rem' }}>
                نود تنبيهك بأن صلاحية حسابك التجريبي محدودة بـ <strong>24 ساعة فقط</strong> من وقت التسجيل.
              </p>
              <p style={{ marginTop: '0.75rem', fontWeight: 600, color: 'var(--warning-color)' }}>
                للاستمرار في تشغيل الشاشات أو ترقية باقتك، يمكنك التواصل مباشرة مع الإدارة والمالك لتفعيل الاشتراك عبر الواتساب.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={() => {
                  localStorage.setItem('smartscreen_first_warn_shown', 'true');
                  setShowFirstWarn(false);
                }}
              >
                أوافق وأفهم
              </button>
              <a
                href={headerWhatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-accent"
                style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none', justifyContent: 'center' }}
              >
                💬 ترقية الآن
              </a>
            </div>
          </div>
        </div>
      )}

      {/* 2. Near-Expiry (10 Minutes) warning modal */}
      {showNearExpiry && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-content" style={{ maxWidth: '500px', border: '3px solid var(--error-color)' }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--error-color)' }}>⏰ تنبيه: اقتراب انتهاء الفترة التجريبية</h3>
            </div>
            <div style={{ margin: '1.5rem 0', lineHeight: '1.6', fontSize: '0.98rem' }}>
              <p style={{ fontWeight: 'bold', color: 'var(--error-color)' }}>انتبه! فترتك التجريبية ستنتهي خلال أقل من 10 دقائق!</p>
              <p style={{ marginTop: '0.75rem' }}>
                سيتم إيقاف عرض المحتوى فوراً على جميع الشاشات النشطة فور انتهاء الوقت. يرجى تمديد الاشتراك الآن لتجنب أي انقطاع.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <a
                href={headerWhatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{ flex: 1, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              >
                💬 تمديد الاشتراك الآن (واتساب)
              </a>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  localStorage.setItem('smartscreen_near_expiry_shown', 'true');
                  setShowNearExpiry(false);
                }}
              >
                إغلاق مؤقت
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Reusable Custom Confirm Dialog */}
      {confirmOpen && (
        <div className="modal-overlay" style={{ zIndex: 1300 }}>
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3>{confirmTitle}</h3>
              <button className="modal-close" onClick={() => setConfirmOpen(false)}>&times;</button>
            </div>
            <div style={{ margin: '1.5rem 0', lineHeight: '1.5', color: 'var(--text-color)' }}>
              {confirmMessage}
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button
                type="button"
                className="btn btn-danger"
                style={{ flex: 1 }}
                onClick={onConfirmCallback}
              >
                {confirmBtnLabel}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setConfirmOpen(false)}
              >
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
