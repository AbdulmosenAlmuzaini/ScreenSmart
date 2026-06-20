import { getDb } from '@/db/database';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { phone, passcode } = await req.json();
    
    if (!phone) {
      return NextResponse.json({ error: 'phone_required' }, { status: 400 });
    }
    
    // Normalize phone number to 9 digits (removing country code or leading 0)
    let cleanedPhone = phone.replace(/\D/g, '');
    if (cleanedPhone.startsWith('966')) {
      cleanedPhone = cleanedPhone.substring(3);
    }
    if (cleanedPhone.startsWith('0')) {
      cleanedPhone = cleanedPhone.substring(1);
    }
    
    // Valid phone starts with '5' and is 9 digits long (Saudi Arabia Mobile)
    if (cleanedPhone.length !== 9 || !cleanedPhone.startsWith('5')) {
      return NextResponse.json({ error: 'invalid_phone' }, { status: 400 });
    }
    
    const db = await getDb();
    
    // Check if this is the admin owner phone number
    const isAdmin = cleanedPhone === '555252341';
    
    if (isAdmin) {
      if (!passcode) {
        return NextResponse.json({ error: 'passcode_required' }, { status: 400 });
      }
      // Owner admin code is set to 'admin123' or the phone number itself
      if (passcode !== 'admin123' && passcode !== '0555252341') {
        return NextResponse.json({ error: 'invalid_passcode' }, { status: 400 });
      }
    }
    
    // Find or create user
    let user = await db.get('SELECT * FROM users WHERE phone = ?', [cleanedPhone]);
    
    if (!user) {
      const expiry = new Date();
      if (isAdmin) {
        expiry.setFullYear(expiry.getFullYear() + 100); // Admin does not expire
      } else {
        expiry.setHours(expiry.getHours() + 24); // 24-hour trial
      }
      
      const role = isAdmin ? 'admin' : 'user';
      const name = isAdmin ? 'Owner Admin' : `User 5${cleanedPhone.substring(1)}`;
      
      const result = await db.run(
        'INSERT INTO users (phone, name, status, role, expiry_date) VALUES (?, ?, ?, ?, ?)',
        [cleanedPhone, name, 'active', role, expiry.toISOString()]
      );
      
      user = {
        id: result.lastID,
        phone: cleanedPhone,
        name,
        status: 'active',
        role,
        expiry_date: expiry.toISOString()
      };
      
      // Create registration audit log
      await db.run(
        'INSERT INTO logs (user_id, phone, action, details) VALUES (?, ?, ?, ?)',
        [user.id, cleanedPhone, 'USER_REGISTER', `Registered new user with 24-hour trial expiring ${expiry.toLocaleString()}`]
      );
    } else {
      if (user.status === 'blocked') {
        return NextResponse.json({ error: 'account_blocked' }, { status: 403 });
      }
      
      // Log login activity
      await db.run(
        'INSERT INTO logs (user_id, phone, action, details) VALUES (?, ?, ?, ?)',
        [user.id, cleanedPhone, 'USER_LOGIN', 'User signed in successfully.']
      );
    }
    
    // Create session object
    const sessionData = {
      id: user.id,
      phone: user.phone,
      role: user.role,
      name: user.name,
      status: user.status,
      expiry_date: user.expiry_date
    };
    
    const sessionString = Buffer.from(JSON.stringify(sessionData)).toString('base64');
    
    const response = NextResponse.json({ success: true, user: sessionData });
    
    // Set HTTP-only cookie
    response.cookies.set({
      name: 'smartscreen_session',
      value: sessionString,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/'
    });
    
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
