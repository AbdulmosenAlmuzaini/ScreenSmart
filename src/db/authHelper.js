import { getDb } from './database';

export async function getSessionUser(req) {
  const sessionCookie = req.cookies.get('smartscreen_session');
  if (!sessionCookie || !sessionCookie.value) {
    return null;
  }
  
  try {
    const decoded = Buffer.from(sessionCookie.value, 'base64').toString('utf8');
    const sessionData = JSON.parse(decoded);
    
    const db = await getDb();
    const user = await db.get('SELECT * FROM users WHERE id = ?', [sessionData.id]);
    
    if (!user || user.status === 'blocked') {
      return null;
    }
    
    const now = new Date();
    const expiry = new Date(user.expiry_date);
    const expired = now > expiry && user.role !== 'admin';
    const isPaused = user.status === 'paused';
    
    return {
      id: user.id,
      phone: user.phone,
      name: user.name,
      role: user.role,
      status: user.status,
      expiry_date: user.expiry_date,
      expired: expired || isPaused,
      isPaused: isPaused
    };
  } catch (error) {
    console.error('Session helper error:', error);
    return null;
  }
}
