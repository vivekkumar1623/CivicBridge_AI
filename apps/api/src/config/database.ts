import mongoose from 'mongoose';
import { config } from './index.js';

let isConnected = false;

/**
 * Connect to MongoDB using Mongoose.
 * Sanitizes the URI for logging to prevent leaking credentials.
 */
export async function connectDatabase(): Promise<typeof mongoose> {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose;
  }

  try {
    const conn = await mongoose.connect(config.mongodbUri);
    isConnected = true;

    // Mask sensitive credentials if present in connection string
    const sanitizedUri = config.mongodbUri.replace(/\/\/[^@]+@/, '//***:***@');
    console.log(`[DATABASE] MongoDB connected successfully: ${sanitizedUri}`);
    return conn;
  } catch (error) {
    const err = error as Error;
    console.error(`[DATABASE] FATAL: Failed to connect to MongoDB: ${err.message}`);
    console.error(
      '[DATABASE] Check that MongoDB is running locally or that MONGODB_URI in .env is valid.',
    );
    process.exit(1);
  }
}

/**
 * Disconnect from MongoDB. Useful for clean test tear-down and graceful shutdown.
 */
export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    isConnected = false;
  }
}
