import { getDb } from '@/db/database';
import { getSessionUser } from '@/db/authHelper';
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const screenId = searchParams.get('screenId');
    
    if (!screenId) {
      return NextResponse.json({ error: 'screenId_required' }, { status: 400 });
    }
    
    const db = await getDb();
    
    // Look up the screen
    const screen = await db.get('SELECT * FROM screens WHERE id = ?', [screenId]);
    if (!screen) {
      return NextResponse.json({ error: 'screen_not_found' }, { status: 404 });
    }
    
    // Look up the owner
    const owner = await db.get('SELECT * FROM users WHERE id = ?', [screen.user_id]);
    if (!owner) {
      return NextResponse.json({ error: 'owner_not_found' }, { status: 404 });
    }
    
    // Rigorous subscription validation
    const now = new Date();
    const expiry = new Date(owner.expiry_date);
    const expired = now > expiry && owner.role !== 'admin';
    const isPaused = owner.status === 'paused' || owner.status === 'blocked';
    
    if (expired || isPaused) {
      return NextResponse.json({ 
        error: 'access_denied_expired', 
        ownerPhone: owner.phone,
        message: 'Subscription has expired or is suspended.' 
      }, { status: 403 });
    }
    
    // Retrieve content slides
    const contents = await db.all('SELECT * FROM contents WHERE screen_id = ? ORDER BY id ASC', [screenId]);
    
    return NextResponse.json({ contents });
  } catch (error) {
    console.error('Fetch contents error:', error);
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
    
    const formData = await req.formData();
    const screenId = formData.get('screenId');
    const title = formData.get('title') || '';
    const type = formData.get('type'); // A-Basic or B-Advanced
    const mediaTypeInput = formData.get('mediaType');
    const durationStr = formData.get('duration');
    const startTime = formData.get('startTime') || null;
    const endTime = formData.get('endTime') || null;
    const widgetText = formData.get('widgetText') || '';
    const widgetUrl = formData.get('widgetUrl') || '';
    const file = formData.get('file');
    
    if (!screenId || !type) {
      return NextResponse.json({ error: 'screenId_and_type_required' }, { status: 400 });
    }
    
    const duration = durationStr ? parseInt(durationStr, 10) : 10;
    const db = await getDb();
    
    // Verify user owns the screen
    const screen = await db.get('SELECT * FROM screens WHERE id = ?', [screenId]);
    if (!screen) {
      return NextResponse.json({ error: 'screen_not_found' }, { status: 404 });
    }
    if (screen.user_id !== user.id && user.role !== 'admin') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    
    let finalUrl = '';
    let mediaType = mediaTypeInput;
    
    if (type === 'A-Basic') {
      if (!file || typeof file === 'string') {
        return NextResponse.json({ error: 'file_required_for_type_a' }, { status: 400 });
      }
      
      // Save file upload
      const buffer = Buffer.from(await file.arrayBuffer());
      const filename = Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      
      // Create public/uploads directory if not exists
      await fs.mkdir(uploadDir, { recursive: true });
      
      const filePath = path.join(uploadDir, filename);
      await fs.writeFile(filePath, buffer);
      
      finalUrl = `/uploads/${filename}`;
      
      // Autofill mediaType based on file format
      if (file.type.startsWith('video/')) {
        mediaType = 'video';
      } else {
        mediaType = 'image';
      }
    } else {
      // Type B (Advanced Widgets)
      if (mediaType === 'widget_clock') {
        finalUrl = 'WIDGET_CLOCK';
      } else if (mediaType === 'widget_announcement') {
        if (!widgetText) {
          return NextResponse.json({ error: 'announcement_text_required' }, { status: 400 });
        }
        finalUrl = widgetText;
      } else if (mediaType === 'widget_url') {
        if (!widgetUrl) {
          return NextResponse.json({ error: 'widget_url_required' }, { status: 400 });
        }
        finalUrl = widgetUrl;
      } else {
        return NextResponse.json({ error: 'invalid_widget_type' }, { status: 400 });
      }
    }
    
    const result = await db.run(
      `INSERT INTO contents (user_id, screen_id, title, type, media_type, url, duration, start_time, end_time) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user.id, screenId, title, type, mediaType, finalUrl, duration, startTime, endTime]
    );
    
    const newContentId = result.lastID;
    
    // Log content addition
    await db.run(
      'INSERT INTO logs (user_id, phone, action, details) VALUES (?, ?, ?, ?)',
      [user.id, user.phone, 'UPLOAD_CONTENT', `Added content id ${newContentId} (${mediaType}) to screen ${screenId}`]
    );
    
    return NextResponse.json({
      success: true,
      content: {
        id: newContentId,
        screen_id: screenId,
        title,
        type,
        media_type: mediaType,
        url: finalUrl,
        duration,
        start_time: startTime,
        end_time: endTime
      }
    });
  } catch (error) {
    console.error('Upload content error:', error);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
