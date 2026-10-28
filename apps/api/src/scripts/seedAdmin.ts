import bcrypt from 'bcryptjs';
import { config } from '../config/index.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { User } from '../models/User.js';

async function seedAdmin() {
  try {
    await connectDatabase();

    const adminEmail = config.adminEmail.toLowerCase().trim();
    const adminName = config.adminName.trim();
    const adminPassword = config.adminPassword;

    if (!adminPassword || adminPassword.length < 10) {
      console.error('FATAL: ADMIN_PASSWORD must be at least 10 characters.');
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(adminPassword, 12);

    const admin = await User.findOneAndUpdate(
      { email: adminEmail },
      {
        name: adminName,
        email: adminEmail,
        passwordHash,
        role: 'admin',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(`[SEED] Admin account verified/created successfully for: ${admin.email}`);
    console.log('[SEED] (Password was securely hashed and not logged)');
  } catch (error) {
    console.error('[SEED] Error seeding admin:', (error as Error).message);
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

seedAdmin();
