import mongoose from 'mongoose';
import { env } from './env.js';

let isConnected = false;

export async function connectDatabase(): Promise<void> {
  if (isConnected) {
    return;
  }

  try {
    mongoose.set('strictQuery', true);
    
    // Connect to MongoDB
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true,
    });

    isConnected = true;
    console.log(`✅ MongoDB connected successfully to ${env.MONGODB_URI}`);
  } catch (error) {
    console.warn(`⚠️ Warning: MongoDB connection to ${env.MONGODB_URI} failed. Error: ${(error as Error).message}`);
    // In local development/test if MongoDB is not running, we log clearly and allow graceful fallback or retry
    if (env.NODE_ENV === 'production') {
      console.error('❌ Fatal error: MongoDB must be available in production.');
      process.exit(1);
    }
  }

  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB connection error:', err);
    isConnected = false;
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ MongoDB disconnected.');
    isConnected = false;
  });

  mongoose.connection.on('reconnected', () => {
    console.log('🔄 MongoDB reconnected.');
    isConnected = true;
  });
}

export async function disconnectDatabase(): Promise<void> {
  if (!isConnected && mongoose.connection.readyState === 0) {
    return;
  }
  try {
    await mongoose.disconnect();
    isConnected = false;
    console.log('🛑 MongoDB disconnected gracefully.');
  } catch (error) {
    console.error('❌ Error disconnecting from MongoDB:', error);
  }
}

export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
