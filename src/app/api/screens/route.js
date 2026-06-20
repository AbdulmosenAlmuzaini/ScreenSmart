import { getDb } from '@/db/database';
import { getSessionUser } from '@/db/authHelper';
import { NextResponse } from 'next/server';

export async function GET(req) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    
    const db = await getDb();
    
    let screens;
    // Admins see all screens in the system; normal users see their own
    if (user.role === 'admin') {
      screens = await db.all('SELECT * FROM screens ORDER BY created_at DESC');
    } else {
      screens = await db.all('SELECT * FROM screens WHERE user_id = ? ORDER BY created_at DESC', [user.id]);
    }
    
    // Hydrate each screen with the number of uploaded slides
    for (let screen of screens) {
      const result = await db.get('SELECT COUNT(*) as count FROM contents WHERE screen_id = ?', [screen.id]);
      screen.slidesCount = result ? result.count : 0;
    }
    
    return NextResponse.json({ screens });
  } catch (error) {
    console.error('Fetch screens error:', error);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    
    // Strict block if user is trial-expired
    if (user.expired) {
      return NextResponse.json({ error: 'access_denied_expired' }, { status: 403 });
    }
    
    const { name, location, slug } = await req.json();
    if (!name) {
      return NextResponse.json({ error: 'name_required' }, { status: 400 });
    }
    
    const db = await getDb();
    
    // Clean and validate custom URL slug or generate a random short alphanumeric ID
    let screenId = slug ? slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-') : '';
    if (!screenId) {
      screenId = Math.random().toString(36).substring(2, 10);
    }
    
    // Check if slug is already taken
    const existing = await db.get('SELECT * FROM screens WHERE id = ?', [screenId]);
    if (existing) {
      if (slug) {
        return NextResponse.json({ error: 'slug_exists' }, { status: 400 });
      }
      screenId = screenId + '-' + Math.random().toString(36).substring(2, 5);
    }
    
    await db.run(
      'INSERT INTO screens (id, user_id, name, location) VALUES (?, ?, ?, ?)',
      [screenId, user.id, name, location || '']
    );
    
    // Log creation event
    await db.run(
      'INSERT INTO logs (user_id, phone, action, details) VALUES (?, ?, ?, ?)',
      [user.id, user.phone, 'CREATE_SCREEN', `Created screen: ${name} (${screenId})`]
    );
    
    return NextResponse.json({ success: true, screen: { id: screenId, name, location } });
  } catch (error) {
    console.error('Create screen error:', error);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
