import { getDb } from '@/db/database';
import { getSessionUser } from '@/db/authHelper';
import { NextResponse } from 'next/server';

export async function GET(req) {
  try {
    const user = await getSessionUser(req);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'forbidden_admin_only' }, { status: 403 });
    }
    
    const db = await getDb();
    
    // Fetch users (except admin themselves, or include all)
    const users = await db.all('SELECT * FROM users ORDER BY created_at DESC');
    
    // Fetch logs
    const logs = await db.all('SELECT * FROM logs ORDER BY created_at DESC LIMIT 300');
    
    return NextResponse.json({ users, logs });
  } catch (error) {
    console.error('Admin GET error:', error);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const adminUser = await getSessionUser(req);
    if (!adminUser || adminUser.role !== 'admin') {
      return NextResponse.json({ error: 'forbidden_admin_only' }, { status: 403 });
    }
    
    const { userId, actionType, durationOption, status } = await req.json();
    
    if (!userId || !actionType) {
      return NextResponse.json({ error: 'missing_parameters' }, { status: 400 });
    }
    
    const db = await getDb();
    
    // Get target user
    const targetUser = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!targetUser) {
      return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
    }
    
    if (actionType === 'extend') {
      if (!durationOption) {
        return NextResponse.json({ error: 'duration_option_required' }, { status: 400 });
      }
      
      const now = new Date();
      const currentExpiry = new Date(targetUser.expiry_date);
      
      // If current expiry is in the past, extension starts from now.
      // If it's in the future, extension adds to the existing expiry date (cumulative).
      let baseDate = now > currentExpiry ? now : currentExpiry;
      
      let extensionLabel = '';
      if (durationOption === '1hour') {
        baseDate.setHours(baseDate.getHours() + 1);
        extensionLabel = '1 Hour';
      } else if (durationOption === 'day') {
        baseDate.setDate(baseDate.getDate() + 1);
        extensionLabel = 'Day Pass';
      } else if (durationOption === 'month') {
        baseDate.setDate(baseDate.getDate() + 30);
        extensionLabel = 'Monthly Plan';
      } else if (durationOption === 'year') {
        baseDate.setDate(baseDate.getDate() + 365);
        extensionLabel = 'Yearly Plan';
      } else {
        return NextResponse.json({ error: 'invalid_duration_option' }, { status: 400 });
      }
      
      const newExpiryStr = baseDate.toISOString();
      
      await db.run(
        'UPDATE users SET expiry_date = ?, status = ? WHERE id = ?',
        [newExpiryStr, 'active', userId] // Automatically reactivate if extended
      );
      
      // Log admin action
      await db.run(
        'INSERT INTO logs (user_id, phone, action, details) VALUES (?, ?, ?, ?)',
        [
          adminUser.id,
          adminUser.phone,
          'ADMIN_EXTEND',
          `Extended phone ${targetUser.phone} subscription by ${extensionLabel}. New expiry: ${baseDate.toLocaleString()}`
        ]
      );
      
      return NextResponse.json({ 
        success: true, 
        newExpiry: newExpiryStr, 
        message: `Extended by ${extensionLabel} successfully.` 
      });
      
    } else if (actionType === 'statusChange') {
      if (!status || !['active', 'paused', 'blocked'].includes(status)) {
        return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
      }
      
      await db.run('UPDATE users SET status = ? WHERE id = ?', [status, userId]);
      
      // Log admin action
      await db.run(
        'INSERT INTO logs (user_id, phone, action, details) VALUES (?, ?, ?, ?)',
        [
          adminUser.id,
          adminUser.phone,
          'ADMIN_STATUS_CHANGE',
          `Changed status of phone ${targetUser.phone} to '${status}'`
        ]
      );
      
      return NextResponse.json({ 
        success: true, 
        newStatus: status, 
        message: `Status updated to ${status} successfully.` 
      });
    }
    
    return NextResponse.json({ error: 'invalid_action_type' }, { status: 400 });
  } catch (error) {
    console.error('Admin POST error:', error);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const adminUser = await getSessionUser(req);
    if (!adminUser || adminUser.role !== 'admin') {
      return NextResponse.json({ error: 'forbidden_admin_only' }, { status: 403 });
    }
    
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: 'userId_required' }, { status: 400 });
    }
    
    const db = await getDb();
    
    // Retrieve user details
    const targetUser = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!targetUser) {
      return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
    }
    
    // Safety check: Admin cannot delete another Admin or themselves
    if (targetUser.role === 'admin') {
      return NextResponse.json({ error: 'cannot_delete_admin' }, { status: 400 });
    }
    
    // Delete user (Foreign key cascading deletes screens & contents)
    await db.run('DELETE FROM users WHERE id = ?', [userId]);
    
    // Log user deletion audit
    await db.run(
      'INSERT INTO logs (user_id, phone, action, details) VALUES (?, ?, ?, ?)',
      [
        adminUser.id,
        adminUser.phone,
        'ADMIN_DELETE_USER',
        `Permanently deleted user phone ${targetUser.phone}`
      ]
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin DELETE user error:', error);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
