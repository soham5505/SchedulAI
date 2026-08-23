import axios, { AxiosInstance } from 'axios';
import {
  ISchedulerInput,
  ISchedulerOutput,
  IValidateTimetableRequest,
  IValidateTimetableResponse,
  IProposedMoveRequest,
  ISuggestionResponse,
} from '@schedulai/shared-types';
import { env } from '../config/env.js';
import { Logger } from './logger.js';

const logger = new Logger('SchedulerClient');

class SchedulerClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: env.SCHEDULER_URL,
      timeout: 120000, // 2 minutes
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health', { timeout: 3000 });
      return response.status === 200 && response.data?.status === 'ok';
    } catch (error) {
      logger.warn(`Scheduler health check failed: ${(error as Error).message}`);
      return false;
    }
  }

  async generate(payload: ISchedulerInput): Promise<ISchedulerOutput> {
    try {
      logger.info(`Sending generation request with ${payload.teachingAssignments.length} assignments`);
      const response = await this.client.post<ISchedulerOutput>('/generate', payload);
      return response.data;
    } catch (error) {
      logger.error(`Scheduler /generate error: ${(error as Error).message}`);
      throw error;
    }
  }

  async validate(payload: IValidateTimetableRequest): Promise<IValidateTimetableResponse> {
    try {
      const response = await this.client.post<IValidateTimetableResponse>('/validate', payload);
      return response.data;
    } catch (error) {
      logger.error(`Scheduler /validate error: ${(error as Error).message}`);
      throw error;
    }
  }

  async suggest(payload: IProposedMoveRequest): Promise<ISuggestionResponse> {
    try {
      const response = await this.client.post<ISuggestionResponse>('/suggest', payload);
      return response.data;
    } catch (error) {
      logger.error(`Scheduler /suggest error: ${(error as Error).message}`);
      throw error;
    }
  }
}

export const schedulerClient = new SchedulerClient();
