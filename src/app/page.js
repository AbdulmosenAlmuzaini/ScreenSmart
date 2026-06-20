'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/translations/LanguageContext';
import './landing.css';

export default function Home() {
  const router = useRouter();
  const { lang, toggleLanguage, t } = useLanguage();
  const [sessionUser, setSessionUser] = useState(null);
  const [checkLoading, setCheckLoading] = useState(true);

  // Set document SEO title dynamically based on selected language
  useEffect(() => {
    if (t && t.landingTitle) {
      document.title = t.landingTitle;
    }
  }, [lang, t]);

  // Check auth status on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/status');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            setSessionUser(data.user);
          }
        }
      } catch (err) {
        console.error('Check auth on landing failed:', err);
      } finally {
        setCheckLoading(false);
      }
    }
    checkAuth();
  }, []);

  const handleCtaClick = () => {
    if (sessionUser) {
      if (sessionUser.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    } else {
      router.push('/login');
    }
  };

  return (
    <div className="landing-wrapper">
      {/* Sticky Header with Language Switcher */}
      <header className="landing-header">
        <div className="brand-title">
          <span>📺</span>
          <span>{lang === 'ar' ? 'شاشة ذكية' : 'SmartScreen'}</span>
          <span className="brand-badge">CMS</span>
        </div>
        
        <div className="header-actions">
          <button 
            type="button" 
            className="lang-toggle-btn"
            onClick={toggleLanguage}
          >
            🌐 {lang === 'ar' ? 'English' : 'العربية'}
          </button>
          
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={handleCtaClick}
            disabled={checkLoading}
            style={{ fontSize: '0.9rem', padding: '0.5rem 1.2rem' }}
          >
            {checkLoading 
              ? '...' 
              : sessionUser 
                ? (sessionUser.role === 'admin' ? t.heroCtaAdmin : t.heroCtaDashboard) 
                : t.heroCtaLogin
            }
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-tagline">
          🚀 {lang === 'ar' ? 'الجيل القادم من الشاشات الرقمية' : 'Next-Gen Digital Signage'}
        </div>
        <h1 className="hero-main-title">
          {t.heroTitle}
        </h1>
        <p className="hero-subtitle">
          {t.heroSubtitle}
        </p>
        
        <button 
          type="button" 
          className="cta-btn-glow"
          onClick={handleCtaClick}
          disabled={checkLoading}
        >
          {checkLoading 
            ? '...' 
            : sessionUser 
              ? (sessionUser.role === 'admin' ? t.heroCtaAdmin : t.heroCtaDashboard) 
              : t.heroCtaLogin
          }
          <span>{lang === 'ar' ? '←' : '→'}</span>
        </button>
      </section>

      {/* About Section */}
      <section className="info-section">
        <h2 className="section-title">{t.aboutTitle}</h2>
        <p className="about-paragraph">
          {t.aboutDesc}
        </p>
      </section>

      {/* Features Grid Section */}
      <section className="info-section">
        <h2 className="section-title">{t.featuresTitle}</h2>
        <div className="features-grid">
          {/* Card 1 */}
          <div className="feature-card">
            <div className="feature-icon-wrapper">📋</div>
            <h3>{t.feature1Title}</h3>
            <p>{t.feature1Desc}</p>
          </div>
          
          {/* Card 2 */}
          <div className="feature-card">
            <div className="feature-icon-wrapper">⚙️</div>
            <h3>{t.feature2Title}</h3>
            <p>{t.feature2Desc}</p>
          </div>
          
          {/* Card 3 */}
          <div className="feature-card">
            <div className="feature-icon-wrapper">⏰</div>
            <h3>{t.feature3Title}</h3>
            <p>{t.feature3Desc}</p>
          </div>
          
          {/* Card 4 */}
          <div className="feature-card">
            <div className="feature-icon-wrapper">⚡</div>
            <h3>{t.feature4Title}</h3>
            <p>{t.feature4Desc}</p>
          </div>
        </div>
      </section>

      {/* Objectives Section */}
      <section className="info-section" style={{ paddingBottom: '6rem' }}>
        <div className="objectives-container">
          <h2 className="section-title" style={{ left: 'auto', transform: 'none', textAlign: lang === 'ar' ? 'right' : 'left' }}>
            {t.objectivesTitle}
          </h2>
          <div className="objectives-list">
            <div className="objective-item">{t.goal1}</div>
            <div className="objective-item">{t.goal2}</div>
            <div className="objective-item">{t.goal3}</div>
            <div className="objective-item">{t.goal4}</div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <p>&copy; {new Date().getFullYear()} {t.footerText}</p>
      </footer>
    </div>
  );
}
