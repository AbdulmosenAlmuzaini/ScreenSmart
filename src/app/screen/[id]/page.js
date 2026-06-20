import React from 'react';
import { getDb } from '@/db/database';
import PlaybackClient from './PlaybackClient';
import './playback.css';

// Pre-render static widgets for the server-side fallback
function ServerClock() {
  const time = new Date();
  const timeString = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStringAr = time.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const dateStringEn = time.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="signage-widget-container" style={{ fontFamily: "'Cairo', sans-serif" }}>
      <div className="clock-time">{timeString}</div>
      <div className="clock-date-ar">{dateStringAr}</div>
      <div className="clock-date-en">{dateStringEn}</div>
    </div>
  );
}

function ServerAnnouncement({ text }) {
  return (
    <div className="signage-widget-container" style={{ fontFamily: "'Almarai', sans-serif" }}>
      <div className="announcement-icon">📢</div>
      <div className="announcement-text">{text}</div>
    </div>
  );
}

// Function to generate dynamic CSS animations for browsers with JS disabled
function generateCSSSlideshow(activeSlides) {
  if (activeSlides.length <= 1) return '';

  const durations = activeSlides.map(s => s.duration || 10);
  const totalDuration = durations.reduce((a, b) => a + b, 0);

  // Disable transition when JS is disabled to prevent browser conflicts with animations
  let css = `
    .slide-item {
      transition: none !important;
    }
  `;
  let accumulatedTime = 0;

  activeSlides.forEach((slide, index) => {
    const startS = accumulatedTime;
    const endS = accumulatedTime + (slide.duration || 10);
    accumulatedTime = endS;

    // Convert seconds to percentages of the total duration loop
    const startP = (startS / totalDuration) * 100;
    const fadeInP = ((startS + 0.8) / totalDuration) * 100; // 0.8s transition
    const fadeOutP = ((endS - 0.8) / totalDuration) * 100; // 0.8s transition
    const endP = (endS / totalDuration) * 100;

    if (index === 0) {
      css += `
        @keyframes css-slide-anim-0 {
          0% { opacity: 1; transform: scale(1); z-index: 2; }
          ${fadeOutP}% { opacity: 1; transform: scale(1); z-index: 2; }
          ${endP}% { opacity: 0; transform: scale(1.06); z-index: 1; }
          99.9% { opacity: 0; transform: scale(1.06); z-index: 1; }
          100% { opacity: 1; transform: scale(1); z-index: 2; }
        }
        .css-slide-0 {
          animation: css-slide-anim-0 ${totalDuration}s infinite ease-in-out;
        }
      `;
    } else {
      css += `
        @keyframes css-slide-anim-${index} {
          0% { opacity: 0; transform: scale(1.06); z-index: 1; }
          ${startP}% { opacity: 0; transform: scale(1.06); z-index: 1; }
          ${fadeInP}% { opacity: 1; transform: scale(1); z-index: 2; }
          ${fadeOutP}% { opacity: 1; transform: scale(1); z-index: 2; }
          ${endP}% { opacity: 0; transform: scale(1.06); z-index: 1; }
          100% { opacity: 0; transform: scale(1.06); z-index: 1; }
        }
        .css-slide-${index} {
          animation: css-slide-anim-${index} ${totalDuration}s infinite ease-in-out;
        }
      `;
    }
  });

  return css;
}

export default async function PlaybackScreen({ params }) {
  const resolvedParams = await params;
  const screenId = resolvedParams.id;

  let contents = [];
  let errorState = null;
  let ownerPhone = '';
  let screen = null;

  try {
    const db = await getDb();
    
    // Look up the screen
    screen = await db.get('SELECT * FROM screens WHERE id = ?', [screenId]);
    if (!screen) {
      errorState = 'screen_not_found';
    } else {
      // Look up the owner
      const owner = await db.get('SELECT * FROM users WHERE id = ?', [screen.user_id]);
      if (!owner) {
        errorState = 'screen_not_found';
      } else {
        ownerPhone = owner.phone;
        
        // Rigorous subscription validation
        const now = new Date();
        const expiry = new Date(owner.expiry_date);
        const expired = now > expiry && owner.role !== 'admin';
        const isPaused = owner.status === 'paused' || owner.status === 'blocked';
        
        if (expired || isPaused) {
          errorState = 'access_denied_expired';
        } else {
          // Retrieve content slides
          contents = await db.all('SELECT * FROM contents WHERE screen_id = ? ORDER BY id ASC', [screenId]);
        }
      }
    }
  } catch (error) {
    console.error('Server GET screen error:', error);
    errorState = 'server_error';
  }

  // 1. Render Expired / Access Denied Lock Screen
  if (errorState === 'access_denied_expired') {
    const waText = encodeURIComponent(`مرحباً، لقد انتهت صلاحية حسابي التجريبي لشاشات SmartScreen وأرغب بتجديد الاشتراك. (الجوال: +966${ownerPhone})`);
    const whatsappLink = `https://wa.me/966555252341?text=${waText}`;

    return (
      <>
        <noscript>
          <meta http-equiv="refresh" content="30" />
        </noscript>
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
      </>
    );
  }

  // 2. Render Screen Not Found Screen
  if (errorState === 'screen_not_found') {
    return (
      <>
        <noscript>
          <meta http-equiv="refresh" content="60" />
        </noscript>
        <div className="signage-error-wrapper">
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '3rem', color: '#d4af37', marginBottom: '1rem', fontFamily: "'Cairo', sans-serif" }}>⚠️ الشاشة غير موجودة</h1>
            <p style={{ fontSize: '1.2rem', color: '#cbd5e1', fontFamily: "'Almarai', sans-serif" }}>عذراً، المعرف الخاص بشاشة العرض '{screenId}' غير مسجل في النظام لدينا.</p>
          </div>
        </div>
      </>
    );
  }

  // Filter scheduled slides for static pre-rendering
  const now = new Date();
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  const nowTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
  
  const activeSlides = contents.filter(slide => {
    if (!slide.start_time || !slide.end_time) return true;
    return nowTimeStr >= slide.start_time && nowTimeStr <= slide.end_time;
  });

  // 3. Render Offline Screen (No active schedule)
  if (activeSlides.length === 0) {
    return (
      <>
        <noscript>
          <meta http-equiv="refresh" content="15" />
        </noscript>
        <div className="signage-error-wrapper" style={{ border: '12px solid #d4af37' }}>
          <div style={{ fontSize: '8vw', color: '#d4af37', marginBottom: '2rem' }}>📺</div>
          <h1 style={{ fontSize: '4.5vw', fontWeight: 'bold', fontFamily: "'Cairo', sans-serif" }}>شاشة SmartScreen الرقمية</h1>
          <p style={{ fontSize: '2vw', color: '#cbd5e1', marginTop: '1rem', maxWidth: '70%', fontFamily: "'Almarai', sans-serif" }}>
            الشاشة متصلة بالإنترنت حالياً. يرجى رفع الوسائط وتفعيل الشرائح وجدولة توقيتها من لوحة التحكم لتظهر في هذا العرض التلقائي.
          </p>
        </div>
      </>
    );
  }

  // Generate the CSS Animations string
  const cssSlideshow = generateCSSSlideshow(activeSlides);
  const firstSlide = activeSlides[0];

  const durations = activeSlides.map(s => s.duration || 10);
  const totalDuration = durations.reduce((a, b) => a + b, 0);
  const refreshInterval = totalDuration > 0 ? totalDuration : 15;

  return (
    <>
      {/* Fallback pure CSS animations and page refresh inside <noscript> for JS-disabled environments */}
      <noscript>
        {cssSlideshow && <style dangerouslySetInnerHTML={{ __html: cssSlideshow }} />}
        <meta http-equiv="refresh" content={refreshInterval} />
      </noscript>

      {/* Viewport container rendered statically */}
      <div className="signage-player-viewport">
        {/* Static background image for first slide */}
        {firstSlide && firstSlide.type === 'A-Basic' && firstSlide.media_type === 'image' && (
          <img
            src={firstSlide.url}
            alt="ambient background"
            className="ambient-bg"
          />
        )}

        <div className="signage-container-9-16">
          {activeSlides.map((slide, index) => {
            const isFirst = index === 0;
            return (
              <div
                key={slide.id}
                className={`slide-item css-slide-${index} ${isFirst ? 'slide-active' : 'slide-inactive'}`}
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
                    autoPlay={isFirst}
                    muted
                    loop
                    playsInline
                    className="slide-media-fit"
                  />
                )}

                {/* Type B: Advanced Widgets & Custom Content */}
                {slide.type === 'B-Advanced' && slide.media_type === 'widget_clock' && (
                  <ServerClock />
                )}

                {slide.type === 'B-Advanced' && slide.media_type === 'widget_announcement' && (
                  <ServerAnnouncement text={slide.url} />
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

      {/* Hydrate client interaction immediately if JavaScript is active */}
      <PlaybackClient
        screenId={screenId}
        initialContents={contents}
        initialErrorState={errorState}
        ownerPhone={ownerPhone}
      />
    </>
  );
}
