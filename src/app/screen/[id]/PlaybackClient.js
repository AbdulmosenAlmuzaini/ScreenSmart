'use client';

import React, { useState, useEffect } from 'react';
import { translations } from '@/translations/translations';

// Custom theme translation provider helper
const t = translations.ar; // Arabic default

// Beautiful full-screen clock component for Type B advanced signage
function SignageClock() {
  const [time, setTime] = useState(null);

  useEffect(() => {
    setTime(new Date());
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!time) {
    return (
      <div className="signage-widget-container">
        <div style={{ fontSize: '4vw', color: '#cbd5e1' }}>جاري التحميل...</div>
      </div>
    );
  }

  const timeString = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStringAr = time.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const dateStringEn = time.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="signage-widget-container" style={{ fontFamily: "'Cairo', sans-serif" }}>
      <div className="clock-time">
        {timeString}
      </div>
      <div className="clock-date-ar">
        {dateStringAr}
      </div>
      <div className="clock-date-en">
        {dateStringEn}
      </div>
    </div>
  );
}

// Beautiful announcement presentation widget for Type B advanced signage
function SignageAnnouncement({ text }) {
  return (
    <div className="signage-widget-container" style={{ fontFamily: "'Almarai', sans-serif" }}>
      <div className="announcement-icon">📢</div>
      <div className="announcement-text">
        {text}
      </div>
    </div>
  );
}

export default function PlaybackClient({ screenId, initialContents = [], initialErrorState = null, ownerPhone = '' }) {
  const [contents, setContents] = useState(initialContents);
  const [errorState, setErrorState] = useState(initialErrorState);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // Poll contents and check owner status in database every 20 seconds
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch(`/api/contents?screenId=${screenId}`);
        if (!res.ok) {
          const data = await res.json();
          if (res.status === 403 && data.error === 'access_denied_expired') {
            setErrorState('access_denied_expired');
          } else if (res.status === 404) {
            setErrorState('screen_not_found');
          } else {
            setErrorState('server_error');
          }
          return;
        }
        
        const data = await res.json();
        setContents(data.contents || []);
        setErrorState(null);
      } catch (err) {
        console.error('Signage client poll error:', err);
      }
    }
    
    const interval = setInterval(loadData, 20000); // 20s poller
    return () => clearInterval(interval);
  }, [screenId]);

  // Handle slide scheduling filters and interval rotation loop
  useEffect(() => {
    if (contents.length === 0) {
      setActiveSlideIndex(0);
      return;
    }
    
    const getActiveSlides = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMin = now.getMinutes();
      const nowTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
      
      return contents.filter(slide => {
        if (!slide.start_time || !slide.end_time) return true;
        return nowTimeStr >= slide.start_time && nowTimeStr <= slide.end_time;
      });
    };
    
    const activeSlides = getActiveSlides();
    if (activeSlides.length === 0) {
      setActiveSlideIndex(-1); // Offline
      return;
    }
    
    // Bounds check
    let idx = activeSlideIndex;
    if (idx >= activeSlides.length || idx < 0) {
      idx = 0;
      setActiveSlideIndex(0);
      return;
    }
    
    const currentSlide = activeSlides[idx];
    const slideDuration = (currentSlide.duration || 10) * 1000;
    
    const timer = setTimeout(() => {
      setActiveSlideIndex((prev) => (prev + 1) % activeSlides.length);
    }, slideDuration);
    
    return () => clearTimeout(timer);
  }, [contents, activeSlideIndex]);

  // 1. Expired / Access Denied Lock Screen
  if (errorState === 'access_denied_expired') {
    const waText = encodeURIComponent(`مرحباً، لقد انتهت صلاحية حسابي التجريبي لشاشات SmartScreen وأرغب بتجديد الاشتراك. (الجوال: +966${ownerPhone})`);
    const whatsappLink = `https://wa.me/966555252341?text=${waText}`;
    
    return (
      <div className="signage-error-wrapper">
        <div className="signage-error-card">
          <div style={{ fontSize: '5rem', color: '#e53e3e', marginBottom: '1.5rem' }}>🔒</div>
          <h1 style={{ color: '#0b2240', fontSize: '2.2rem', fontWeight: '800', marginBottom: '1.5rem', fontFamily: "'Cairo', sans-serif" }}>
            انتهت فترة الاشتراك التجريبي
          </h1>
          <p style={{ color: '#4a5568', fontSize: '1.15rem', lineHeight: '1.6', marginBottom: '2.5rem', fontFamily: "'Almarai', sans-serif" }}>
            صلاحية حسابك التجريبي محدودة بـ 24 ساعة فقط. للاستمرار في الخدمة أو تفعيل الشاشة، يرجى التواصل مباشرة مع المالك/المشرف عبر الواتساب لتمديد الاشتراك.
          </p>
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="whatsapp-btn"
          >
            💬 تواصل مع المالك عبر الواتساب
          </a>
        </div>
      </div>
    );
  }

  // 2. Screen Not Found Screen
  if (errorState === 'screen_not_found') {
    return (
      <div className="signage-error-wrapper">
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '3rem', color: '#d4af37', marginBottom: '1rem', fontFamily: "'Cairo', sans-serif" }}>⚠️ الشاشة غير موجودة</h1>
          <p style={{ fontSize: '1.2rem', color: '#cbd5e1', fontFamily: "'Almarai', sans-serif" }}>عذراً، المعرف الخاص بشاشة العرض '{screenId}' غير مسجل في النظام لدينا.</p>
        </div>
      </div>
    );
  }

  // Get active scheduled slides for rendering
  const getActiveSlidesList = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const nowTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
    
    return contents.filter(slide => {
      if (!slide.start_time || !slide.end_time) return true;
      return nowTimeStr >= slide.start_time && nowTimeStr <= slide.end_time;
    });
  };

  const activeSlides = getActiveSlidesList();

  // 3. Offline Screen (Online but no active schedule)
  if (activeSlides.length === 0 || activeSlideIndex === -1) {
    return (
      <div className="signage-error-wrapper" style={{ border: '12px solid #d4af37' }}>
        <div style={{ fontSize: '8vw', color: '#d4af37', marginBottom: '2rem' }}>📺</div>
        <h1 style={{ fontSize: '4.5vw', fontWeight: 'bold', fontFamily: "'Cairo', sans-serif" }}>شاشة SmartScreen الرقمية</h1>
        <p style={{ fontSize: '2vw', color: '#cbd5e1', marginTop: '1rem', maxWidth: '70%', fontFamily: "'Almarai', sans-serif" }}>
          الشاشة متصلة بالإنترنت حالياً. يرجى رفع الوسائط وتفعيل الشرائح وجدولة توقيتها من لوحة التحكم لتظهر في هذا العرض التلقائي.
        </p>
      </div>
    );
  }

  const currentSlide = activeSlides[activeSlideIndex] || null;

  return (
    <div className="signage-player-viewport js-enabled">
      {/* Dynamic Ambient Blurred Background for visual excellence */}
      {currentSlide && currentSlide.type === 'A-Basic' && currentSlide.media_type === 'image' && (
        <img
          key={`ambient-${currentSlide.id}`}
          src={currentSlide.url}
          alt="ambient background"
          className="ambient-bg"
        />
      )}

      {/* Main TikTok Responsive Aspect Ratio Container */}
      <div className="signage-container-9-16">
        {activeSlides.map((slide, index) => {
          const isActive = index === activeSlideIndex;
          
          return (
            <div
              key={slide.id}
              className={`slide-item css-slide-${index} ${isActive ? 'slide-active' : 'slide-inactive'}`}
            >
              {/* Type A: Basic Media Files */}
              {slide.type === 'A-Basic' && slide.media_type === 'image' && (
                <img
                  src={slide.url}
                  alt={slide.title || "Signage Media"}
                  className="slide-media-fit"
                />
              )}

              {slide.type === 'A-Basic' && slide.media_type === 'video' && (
                <video
                  src={slide.url}
                  autoPlay={isActive}
                  muted
                  loop
                  playsInline
                  className="slide-media-fit"
                />
              )}

              {/* Type B: Advanced Widgets & Custom Content */}
              {slide.type === 'B-Advanced' && slide.media_type === 'widget_clock' && (
                <SignageClock />
              )}

              {slide.type === 'B-Advanced' && slide.media_type === 'widget_announcement' && (
                <SignageAnnouncement text={slide.url} />
              )}

              {slide.type === 'B-Advanced' && slide.media_type === 'widget_url' && (
                <iframe
                  src={slide.url}
                  title="Signage Website"
                  className="slide-iframe-fit"
                  sandbox="allow-scripts allow-same-origin allow-popups"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
