'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/translations/LanguageContext';
import './login.css';

export default function Login() {
  const router = useRouter();
  const { t } = useLanguage();
  
  const [phone, setPhone] = useState('');
  const [passcode, setPasscode] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [captchaText, setCaptchaText] = useState('');
  
  const [showAdminPasscode, setShowAdminPasscode] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const canvasRef = useRef(null);

  // Generate new captcha text and draw it on mount
  useEffect(() => {
    generateCaptcha();
  }, []); // run once on mount

  // Detect admin number to show passcode field
  useEffect(() => {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('966')) cleaned = cleaned.substring(3);
    if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
    
    if (cleaned === '555252341') {
      setShowAdminPasscode(true);
    } else {
      setShowAdminPasscode(false);
      setPasscode('');
    }
  }, [phone]);

  const generateCaptcha = () => {
    // Exclude easily confused characters like I, O, 1, 0, Z, 2 (sometimes)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXY3456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCaptchaText(code);
    
    // Slight delay to ensure canvas element exists in the DOM
    setTimeout(() => {
      drawCaptcha(code);
    }, 50);
  };

  const drawCaptcha = (text) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Clear and draw background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw text with noise/distortion
    ctx.font = 'bold 24px monospace';
    ctx.textBaseline = 'middle';
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      ctx.fillStyle = ['#0b2240', '#d4af37', '#1e293b', '#475569'][Math.floor(Math.random() * 4)];
      ctx.save();
      
      // Position characters with slight random offsets
      const x = 15 + i * 26 + Math.random() * 6;
      const y = canvas.height / 2 + (Math.random() * 8 - 4);
      const angle = (Math.random() * 20 - 10) * Math.PI / 180;
      
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillText(char, 0, 0);
      ctx.restore();
    }
    
    // Draw interference lines
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = ['#cbd5e1', '#d4af37', '#94a3b8'][Math.floor(Math.random() * 3)];
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.stroke();
    }
    
    // Draw interference dots
    for (let i = 0; i < 25; i++) {
      ctx.fillStyle = '#d4af37';
      ctx.beginPath();
      ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, 1, 0, 2 * Math.PI);
      ctx.fill();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    // Client-side phone validation
    let cleanedPhone = phone.replace(/\D/g, '');
    if (cleanedPhone.startsWith('966')) cleanedPhone = cleanedPhone.substring(3);
    if (cleanedPhone.startsWith('0')) cleanedPhone = cleanedPhone.substring(1);
    
    if (cleanedPhone.length !== 9 || !cleanedPhone.startsWith('5')) {
      setError(t.phoneError);
      setLoading(false);
      return;
    }
    
    // Client-side CAPTCHA verification
    if (captchaInput.trim().toUpperCase() !== captchaText) {
      setError(t.captchaError);
      setLoading(false);
      generateCaptcha();
      setCaptchaInput('');
      return;
    }
    
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanedPhone,
          passcode: showAdminPasscode ? passcode : undefined
        })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        if (data.error === 'invalid_passcode') {
          setError(t.adminPasscodeError);
        } else if (data.error === 'account_blocked') {
          setError(t.statusBlocked + " - " + t.accessDenied);
        } else {
          setError(t.phoneError);
        }
        setLoading(false);
        return;
      }
      
      // Redirect on success
      if (data.user.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="logo-section">
          <div className="logo-icon">SS</div>
          <h2>{t.appName}</h2>
          <p>{t.loginSubtitle}</p>
        </div>
        
        {error && (
          <div className="login-error">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t.phoneLabel}</label>
            <div className="phone-input-wrapper">
              <div className="country-badge">
                <div className="saudi-flag-mini">
                  <div style={{
                    width: '4px',
                    height: '4px',
                    backgroundColor: '#ffffff',
                    borderRadius: '50%',
                    position: 'absolute',
                    top: '4px',
                    left: '7px'
                  }} />
                </div>
                <span>+966</span>
              </div>
              <input
                type="tel"
                className="phone-control"
                placeholder={t.phonePlaceholder}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>
          
          {showAdminPasscode && (
            <div className="admin-field-container">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ color: 'var(--primary-color)' }}>
                  🔑 {t.adminPasscodeLabel}
                </label>
                <input
                  type="password"
                  className="form-control"
                  placeholder={t.adminPasscodePlaceholder}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>
          )}
          
          <div className="form-group">
            <label className="form-label">{t.captchaLabel}</label>
            <div className="captcha-container">
              <div className="captcha-canvas-box">
                <canvas ref={canvasRef} width="150" height="48" />
              </div>
              <button 
                type="button" 
                className="captcha-refresh-btn" 
                onClick={generateCaptcha}
                tabIndex="-1"
              >
                🔄 {t.captchaRefresh}
              </button>
            </div>
            <input
              type="text"
              className="form-control"
              placeholder={t.captchaPlaceholder}
              value={captchaInput}
              onChange={(e) => setCaptchaInput(e.target.value)}
              required
              disabled={loading}
              autoComplete="off"
            />
          </div>
          
          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '1rem', padding: '0.85rem' }}
            disabled={loading}
          >
            {loading ? t.loading : t.loginBtn}
          </button>
        </form>
      </div>
    </div>
  );
}
