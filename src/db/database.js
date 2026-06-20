import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

let dbInstance = null;

export async function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = path.join(process.cwd(), 'database.sqlite');
  
  dbInstance = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Enable foreign keys
  await dbInstance.run('PRAGMA foreign_keys = ON');

  // Initialize tables
  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE NOT NULL,
      name TEXT,
      status TEXT NOT NULL DEFAULT 'active', /* active, paused, blocked */
      role TEXT NOT NULL DEFAULT 'user', /* user, admin */
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expiry_date DATETIME NOT NULL
    );

    CREATE TABLE IF NOT EXISTS screens (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      location TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS contents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      screen_id TEXT NOT NULL,
      title TEXT,
      type TEXT NOT NULL, /* A-Basic, B-Advanced */
      media_type TEXT NOT NULL, /* image, video, widget_clock, widget_announcement, widget_url */
      url TEXT NOT NULL, /* file path or URL or custom config */
      duration INTEGER DEFAULT 10,
      start_time TEXT, /* HH:MM format */
      end_time TEXT, /* HH:MM format */
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(screen_id) REFERENCES screens(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      phone TEXT,
      action TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Ensure Admin user exists
  const adminPhone = '0555252341';
  const admin = await dbInstance.get('SELECT * FROM users WHERE phone = ?', [adminPhone]);
  if (!admin) {
    const farExpiry = new Date();
    farExpiry.setFullYear(farExpiry.getFullYear() + 100); // Admin does not expire
    const expiryStr = farExpiry.toISOString();
    
    await dbInstance.run(
      'INSERT INTO users (phone, name, status, role, expiry_date) VALUES (?, ?, ?, ?, ?)',
      [adminPhone, 'Owner Admin', 'active', 'admin', expiryStr]
    );
    
    await dbInstance.run(
      'INSERT INTO logs (phone, action, details) VALUES (?, ?, ?)',
      [adminPhone, 'SYSTEM_INIT', 'System initialized. Default admin seeded.']
    );
  }

  // Seed demo screens and playlist contents if they do not exist
  const demoScreen = await dbInstance.get('SELECT * FROM screens WHERE id = ?', ['demo-screen']);
  if (!demoScreen) {
    const adminUser = await dbInstance.get('SELECT * FROM users WHERE phone = ?', [adminPhone]);
    if (adminUser) {
      // Insert demo-screen
      await dbInstance.run(
        'INSERT INTO screens (id, user_id, name, location) VALUES (?, ?, ?, ?)',
        ['demo-screen', adminUser.id, 'Demo Reception Hall', 'Main Reception Desk Lobby']
      );
      
      // Insert welcome image slide (Type A)
      await dbInstance.run(
        `INSERT INTO contents (user_id, screen_id, title, type, media_type, url, duration) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [adminUser.id, 'demo-screen', 'Gold Welcome Slide', 'A-Basic', 'image', '/uploads/welcome_slide.png', 10]
      );
      
      // Insert digital clock widget (Type B)
      await dbInstance.run(
        `INSERT INTO contents (user_id, screen_id, title, type, media_type, url, duration) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [adminUser.id, 'demo-screen', 'Digital Clock Widget', 'B-Advanced', 'widget_clock', 'WIDGET_CLOCK', 8]
      );
      
      // Insert text announcement (Type B)
      await dbInstance.run(
        `INSERT INTO contents (user_id, screen_id, title, type, media_type, url, duration) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [adminUser.id, 'demo-screen', 'Text Announcement Notice', 'B-Advanced', 'widget_announcement', '📢 Welcome to SmartScreen CMS! Manage this loop from your dashboard.', 8]
      );
      
      await dbInstance.run(
        'INSERT INTO logs (phone, action, details) VALUES (?, ?, ?)',
        [adminPhone, 'SYSTEM_SEED', 'Demo screen and playlists seeded successfully.']
      );
    }
  }

  return dbInstance;
}
