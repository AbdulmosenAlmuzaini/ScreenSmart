'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/translations/LanguageContext';

export default function Home() {
  const router = useRouter();
  const { t } = useLanguage();

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/status');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            if (data.user.role === 'admin') {
              router.push('/admin');
            } else {
              router.push('/dashboard');
            }
            return;
          }
        }
        router.push('/login');
      } catch (err) {
        router.push('/login');
      }
    }
    checkAuth();
  }, [router]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#ffffff',
      color: '#0b2240',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif'
    }}>
      <div style={{
        border: '3px solid rgba(11, 34, 64, 0.1)',
        borderTopColor: '#0b2240',
        borderRadius: '50%',
        width: '36px',
        height: '36px',
        animation: 'spin 0.8s linear infinite',
        marginBottom: '1rem'
      }} />
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <p style={{ fontWeight: '500' }}>{t?.loading || "Loading..."}</p>
    </div>
  );
}
