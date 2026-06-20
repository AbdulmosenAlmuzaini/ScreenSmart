import { getDb } from '@/db/database';
import { NextResponse } from 'next/server';

export async function GET(req) {
  try {
    const sessionCookie = req.cookies.get('smartscreen_session');
    
    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    
    let sessionData;
    try {
      const decoded = Buffer.from(sessionCookie.value, 'base64').toString('utf8');
      sessionData = JSON.parse(decoded);
    } catch (e) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    
    const db = await getDb();
    const user = await db.get('SELECT * FROM users WHERE id = ?', [sessionData.id]);
    
    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    
    if (user.status === 'blocked') {
      const response = NextResponse.json({ authenticated: false, error: 'blocked' }, { status: 403 });
      response.cookies.delete('smartscreen_session');
      return response;
    }
    
    // Check trial/subscription expiry (only for standard users)
    const now = new Date();
    const expiry = new Date(user.expiry_date);
    const expired = now > expiry && user.role !== 'admin';
    const isPaused = user.status === 'paused';
    
    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        role: user.role,
        status: user.status,
        expiry_date: user.expiry_date,
        expired: expired || isPaused,
        isPaused: isPaused
      }
    });
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
