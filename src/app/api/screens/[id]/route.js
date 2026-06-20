import { getDb } from '@/db/database';
import { getSessionUser } from '@/db/authHelper';
import { NextResponse } from 'next/server';

export async function DELETE(req, { params }) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    
    if (user.expired) {
      return NextResponse.json({ error: 'access_denied_expired' }, { status: 403 });
    }
    
    const { id } = await params;
    const db = await getDb();
    
    // Check screen existence and ownership
    const screen = await db.get('SELECT * FROM screens WHERE id = ?', [id]);
    if (!screen) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    
    // Non-admin can only delete their own screens
    if (screen.user_id !== user.id && user.role !== 'admin') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    
    // Delete screen (foreign key constraints ON DELETE CASCADE will handle contents)
    await db.run('DELETE FROM screens WHERE id = ?', [id]);
    
    // Log deletion event
    await db.run(
      'INSERT INTO logs (user_id, phone, action, details) VALUES (?, ?, ?, ?)',
      [user.id, user.phone, 'DELETE_SCREEN', `Deleted screen: ${screen.name} (${id})`]
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete screen error:', error);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
