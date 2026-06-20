'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/translations/LanguageContext';
import './admin.css';

export default function AdminDashboard() {
  const router = useRouter();
  const { t } = useLanguage();
  
  const [adminUser, setAdminUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Dashboard state
  const [activeTab, setActiveTab] = useState('users'); // users, logs
  const [searchQuery, setSearchQuery] = useState('');
  const [logSearchQuery, setLogSearchQuery] = useState('');
  
  // Modal state
  const [selectedUser, setSelectedUser] = useState(null);
  const [durationOption, setDurationOption] = useState('none'); // Default to 'none' to prevent auto-extensions
  const [statusOverride, setStatusOverride] = useState('active');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalSuccess, setModalSuccess] = useState('');
  const [modalError, setModalError] = useState('');

  // Custom Confirm modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');
  const [onConfirmCallback, setOnConfirmCallback] = useState(null);
  const [confirmBtnLabel, setConfirmBtnLabel] = useState('');

  // Function to show custom confirm dialog
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

  // Handler to call DELETE on /api/admin for user deletion
  const handleDeleteUser = async (userId, userPhone) => {
    showCustomConfirm(
      "حذف المستخدم نهائياً",
      `هل أنت متأكد من رغبتك في حذف العميل صاحب الرقم (+966 ${userPhone}) نهائياً؟ سيتم حذف جميع شاشات العرض والوسائط والملفات الخاصة به فوراً ولا يمكن التراجع عن هذا الإجراء.`,
      async () => {
        try {
          const res = await fetch(`/api/admin?userId=${userId}`, { method: 'DELETE' });
          if (res.ok) {
            await refreshData();
          } else {
            const data = await res.json();
            // Show custom alert instead of browser alert
            showCustomConfirm("فشل حذف المستخدم", data.error || "عذراً، حدث خطأ أثناء محاولة حذف المستخدم.", () => {}, "حسناً");
          }
        } catch (err) {
          console.error(err);
          showCustomConfirm("خطأ", "عذراً، حدث خطأ غير متوقع أثناء محاولة حذف المستخدم.", () => {}, "حسناً");
        }
      }
    );
  };

  // Authentication and role verification
  useEffect(() => {
    async function loadAdminData() {
      try {
        const res = await fetch('/api/auth/status');
        if (!res.ok) {
          router.push('/login');
          return;
        }
        
        const data = await res.json();
        if (!data.authenticated || data.user.role !== 'admin') {
          router.push('/login');
          return;
        }
        
        setAdminUser(data.user);
        await refreshData();
        setLoading(false);
      } catch (err) {
        console.error(err);
        router.push('/login');
      }
    }
    
    loadAdminData();
  }, [router]);

  const refreshData = async () => {
    try {
      const res = await fetch('/api/admin');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    }
  };

  const handleOpenModifyModal = (user) => {
    setSelectedUser(user);
    setStatusOverride(user.status);
    setDurationOption('none'); // Default to none!
    setModalSuccess('');
    setModalError('');
  };

  const handleCloseModal = () => {
    setSelectedUser(null);
    setModalSuccess('');
    setModalError('');
  };

  // Submit subscription extensions / status overrides
  const handleApplyChanges = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    
    setModalLoading(true);
    setModalSuccess('');
    setModalError('');
    
    try {
      // 1. Handle Status Change if status was modified
      if (statusOverride !== selectedUser.status) {
        const res = await fetch('/api/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: selectedUser.id,
            actionType: 'statusChange',
            status: statusOverride
          })
        });
        
        if (!res.ok) {
          const data = await res.json();
          setModalError(data.error || 'Failed to update status.');
          setModalLoading(false);
          return;
        }
      }
      
      // 2. Handle Subscription Extension only if an option is chosen
      if (durationOption !== 'none') {
        const resExtend = await fetch('/api/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: selectedUser.id,
            actionType: 'extend',
            durationOption: durationOption
          })
        });
        
        const dataExtend = await resExtend.json();
        if (!resExtend.ok) {
          setModalError(dataExtend.error || 'Failed to extend subscription.');
          setModalLoading(false);
          return;
        }
      }
      
      setModalSuccess("تم تطبيق التغييرات بنجاح");
      await refreshData();
      
      setTimeout(() => {
        handleCloseModal();
      }, 1000);
    } catch (err) {
      console.error(err);
      setModalError('An error occurred.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleLogout = async () => {
    const res = await fetch('/api/auth/logout', { method: 'POST' });
    if (res.ok) {
      router.push('/login');
    }
  };

  // Determine user expiry tags visually
  const getUserStatusBadge = (user) => {
    if (user.status === 'blocked') {
      return <span className="status-badge blocked">{t.statusBlocked}</span>;
    }
    if (user.status === 'paused') {
      return <span className="status-badge paused">{t.statusPaused}</span>;
    }
    
    const now = new Date();
    const expiry = new Date(user.expiry_date);
    if (now > expiry && user.role !== 'admin') {
      return <span className="status-badge expired">{t.statusExpired}</span>;
    }
    
    return <span className="status-badge active">{t.statusActive}</span>;
  };

  // Filter lists based on search queries
  const filteredUsers = users.filter(u => {
    const query = searchQuery.toLowerCase();
    return (
      (u.name && u.name.toLowerCase().includes(query)) ||
      (u.phone && u.phone.toLowerCase().includes(query))
    );
  });

  const filteredLogs = logs.filter(l => {
    const query = logSearchQuery.toLowerCase();
    return (
      (l.phone && l.phone.toLowerCase().includes(query)) ||
      (l.action && l.action.toLowerCase().includes(query)) ||
      (l.details && l.details.toLowerCase().includes(query))
    );
  });

  // Calculate Metrics
  const totalUserCount = users.length;
  const activeCount = users.filter(u => {
    const expiry = new Date(u.expiry_date);
    return u.status === 'active' && (new Date() < expiry || u.role === 'admin');
  }).length;
  const pausedCount = users.filter(u => u.status === 'paused').length;
  const blockedCount = users.filter(u => u.status === 'blocked').length;

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

  return (
    <div className="admin-wrapper">
      {/* Header */}
      <header className="admin-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            background: 'var(--bg-color)',
            color: 'var(--primary-color)',
            width: '32px',
            height: '32px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            border: '1px solid var(--accent-color)'
          }}>SS</div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{t.adminTitle}</h1>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn btn-accent" onClick={() => router.push('/dashboard')}>
            📺 {t.navDashboard}
          </button>
          <button className="btn btn-danger" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} onClick={handleLogout}>
            🚪 {t.navLogout}
          </button>
        </div>
      </header>
      
      {/* Dashboard Content Container */}
      <div className="admin-container">
        {/* Metrics Grid */}
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-info">
              <h4>Total Registrants</h4>
              <p>{totalUserCount}</p>
            </div>
            <div className="metric-icon">👥</div>
          </div>
          
          <div className="metric-card">
            <div className="metric-info">
              <h4>Active Subscriptions</h4>
              <p>{activeCount}</p>
            </div>
            <div className="metric-icon">🟢</div>
          </div>
          
          <div className="metric-card">
            <div className="metric-info">
              <h4>Paused / Suspended</h4>
              <p>{pausedCount}</p>
            </div>
            <div className="metric-icon">🟡</div>
          </div>
          
          <div className="metric-card">
            <div className="metric-info">
              <h4>Blocked Users</h4>
              <p>{blockedCount}</p>
            </div>
            <div className="metric-icon">🔴</div>
          </div>
        </div>
        
        {/* Tabs switcher */}
        <div>
          <div className="admin-tabs">
            <button
              className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              📋 {t.userDirectory}
            </button>
            <button
              className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
              onClick={() => setActiveTab('logs')}
            >
              📜 {t.logsTab}
            </button>
          </div>
          
          {/* Tab 1: User Directory List */}
          {activeTab === 'users' && (
            <div className="tab-content" style={{ animation: 'fadeIn 0.2s ease' }}>
              <div className="search-container">
                <div className="search-box">
                  <input
                    type="text"
                    className="form-control"
                    placeholder={t.searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              
              {filteredUsers.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                  {t.noUsers}
                </p>
              ) : (
                <div className="data-table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t.colName}</th>
                        <th>{t.colPhone}</th>
                        <th>{t.colStatus}</th>
                        <th>{t.colExpiry}</th>
                        <th>{t.colActions}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map(user => (
                        <tr key={user.id}>
                          <td style={{ fontWeight: 600 }}>{user.name}</td>
                          <td>+966 {user.phone}</td>
                          <td>{getUserStatusBadge(user)}</td>
                          <td>
                            {user.role === 'admin' 
                              ? 'Infinite (Admin)' 
                              : new Date(user.expiry_date).toLocaleString('ar-SA')}
                          </td>
                          <td>
                            {user.role !== 'admin' && (
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                                  onClick={() => handleOpenModifyModal(user)}
                                >
                                  ⚙️ {t.extendBtn}
                                </button>
                                <button
                                  className="btn btn-danger"
                                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                                  onClick={() => handleDeleteUser(user.id, user.phone)}
                                >
                                  🗑️ حذف
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          
          {/* Tab 2: System Logs */}
          {activeTab === 'logs' && (
            <div className="tab-content" style={{ animation: 'fadeIn 0.2s ease' }}>
              <div className="search-container">
                <div className="search-box">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search logs by phone, action, details..."
                    value={logSearchQuery}
                    onChange={(e) => setLogSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              
              {filteredLogs.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                  {t.noLogs}
                </p>
              ) : (
                <div className="data-table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t.colTimestamp}</th>
                        <th>{t.colActorPhone}</th>
                        <th>{t.colActionType}</th>
                        <th>{t.colDetails}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map(log => (
                        <tr key={log.id}>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td style={{ fontWeight: 'bold' }}>
                            {log.phone ? `+966 ${log.phone}` : 'SYSTEM'}
                          </td>
                          <td>
                            <code style={{
                              backgroundColor: 'var(--card-bg)',
                              padding: '0.2rem 0.4rem',
                              borderRadius: '4px',
                              color: 'var(--primary-color)',
                              fontWeight: 'bold',
                              fontSize: '0.85rem'
                            }}>
                              {log.action}
                            </code>
                          </td>
                          <td style={{ fontSize: '0.88rem' }}>{log.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Extend / Modify Access Modal */}
      {selectedUser && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t.extendDialogTitle.replace('{phone}', '+966 ' + selectedUser.phone)}</h3>
              <button className="modal-close" onClick={handleCloseModal}>&times;</button>
            </div>
            
            {modalSuccess && (
              <div className="status-badge active" style={{ display: 'block', width: '100%', marginBottom: '1rem', padding: '0.6rem' }}>
                ✅ {modalSuccess}
              </div>
            )}
            
            {modalError && (
              <div className="login-error" style={{ marginBottom: '1rem' }}>
                <span>⚠️</span>
                <span>{modalError}</span>
              </div>
            )}
            
            <form onSubmit={handleApplyChanges}>
              {/* Option to extend duration */}
              <div className="form-group">
                <label className="form-label">{t.extendSelectLabel}</label>
                <select
                  className="form-control"
                  value={durationOption}
                  onChange={(e) => setDurationOption(e.target.value)}
                >
                  <option value="none">➡️ لا يوجد تمديد (إبقاء المدة كما هي)</option>
                  <option value="1hour">⏳ {t.add1Hour}</option>
                  <option value="day">☀️ {t.dayPass}</option>
                  <option value="month">📅 {t.monthlyPlan}</option>
                  <option value="year">👑 {t.yearlyPlan}</option>
                </select>
              </div>
              
              {/* Option to override status */}
              <div className="form-group" style={{ marginTop: '1.5rem' }}>
                <label className="form-label">{t.manualStatusLabel}</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="status-override"
                      value="active"
                      checked={statusOverride === 'active'}
                      onChange={() => setStatusOverride('active')}
                    />
                    🟢 {t.statusActiveBtn}
                  </label>
                  
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="status-override"
                      value="paused"
                      checked={statusOverride === 'paused'}
                      onChange={() => setStatusOverride('paused')}
                    />
                    🟡 {t.statusPauseBtn}
                  </label>
                  
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="status-override"
                      value="blocked"
                      checked={statusOverride === 'blocked'}
                      onChange={() => setStatusOverride('blocked')}
                    />
                    🔴 {t.statusBlockBtn}
                  </label>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={modalLoading}
                >
                  {modalLoading ? t.loading : t.saveChangesBtn}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCloseModal}
                  disabled={modalLoading}
                >
                  {t.cancel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Confirm Modal */}
      {confirmOpen && (
        <div className="modal-overlay" onClick={() => setConfirmOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            borderTop: confirmBtnLabel === "حسناً" 
              ? '4px solid var(--accent-color)' 
              : '4px solid var(--error-color)'
          }}>
            <div className="modal-header" style={{ paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              <h3 style={{ 
                color: confirmBtnLabel === "حسناً" 
                  ? 'var(--primary-color)' 
                  : 'var(--error-color)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                {confirmBtnLabel === "حسناً" ? 'ℹ️' : '⚠️'} {confirmTitle}
              </h3>
              <button className="modal-close" onClick={() => setConfirmOpen(false)}>&times;</button>
            </div>
            
            <div style={{ 
              marginBottom: '2rem', 
              fontSize: '1rem', 
              lineHeight: '1.6', 
              color: 'var(--text-color)' 
            }}>
              {confirmMessage}
            </div>
            
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                type="button"
                className={confirmBtnLabel === "حسناً" ? "btn btn-primary" : "btn btn-danger"}
                style={{ flex: 1 }}
                onClick={() => {
                  if (onConfirmCallback) {
                    onConfirmCallback();
                  } else {
                    setConfirmOpen(false);
                  }
                }}
              >
                {confirmBtnLabel || "نعم، احذف"}
              </button>
              
              {confirmBtnLabel !== "حسناً" && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setConfirmOpen(false)}
                >
                  {t.cancel || "إلغاء"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
