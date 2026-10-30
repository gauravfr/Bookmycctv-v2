import mongoose from 'mongoose';
import type { AppLogger } from '../config/logger.js';

export interface DatabaseHealth {
  isReady(): boolean;
}

export class MongoDatabase implements DatabaseHealth {
  private ready = false;
  public constructor(
    private readonly uri: string,
    private readonly timeout: number,
    private readonly logger: AppLogger,
  ) {}
  public isReady(): boolean {
    return this.ready && mongoose.connection.readyState === 1;
  }
  public async connect(): Promise<void> {
    this.ready = false;
    try {
      await mongoose.connect(this.uri, {
        serverSelectionTimeoutMS: this.timeout,
        connectTimeoutMS: this.timeout,
        autoIndex: false,
      });
      this.ready = true;
      this.logger.info('MongoDB connection established');
    } catch (error) {
      this.logger.error({ err: error }, 'MongoDB connection failed');
      throw new Error('Unable to connect to MongoDB', { cause: error });
    }
  }
  public async disconnect(): Promise<void> {
    this.ready = false;
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    this.logger.info('MongoDB connection closed');
  }
}
