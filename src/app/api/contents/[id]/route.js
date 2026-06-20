import { getDb } from '@/db/database';
import { getSessionUser } from '@/db/authHelper';
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

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
    
    // Find content details
    const content = await db.get('SELECT * FROM contents WHERE id = ?', [id]);
    if (!content) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    
    // Find target screen to check ownership
    const screen = await db.get('SELECT * FROM screens WHERE id = ?', [content.screen_id]);
    if (!screen) {
      return NextResponse.json({ error: 'screen_not_found' }, { status: 404 });
    }
    
    // Only owner of the screen or admin can delete content
    if (screen.user_id !== user.id && user.role !== 'admin') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    
    // If it's a Type A media file, delete the file from the local storage
    if (content.type === 'A-Basic' && content.url.startsWith('/uploads/')) {
      try {
        const filePath = path.join(process.cwd(), 'public', content.url);
        await fs.unlink(filePath);
      } catch (err) {
        console.warn('Failed to delete file from disk:', err.message);
      }
    }
    
    // Delete content row from DB
    await db.run('DELETE FROM contents WHERE id = ?', [id]);
    
    // Log content deletion
    await db.run(
      'INSERT INTO logs (user_id, phone, action, details) VALUES (?, ?, ?, ?)',
      [user.id, user.phone, 'DELETE_CONTENT', `Deleted content id ${id} from screen ${content.screen_id}`]
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete content error:', error);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
