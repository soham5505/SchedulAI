import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { GenerationService } from '../modules/generations/generation.service.js';
import { SemesterModel } from '../models/semester.model.js';
import { Logger } from '../utils/logger.js';

dotenv.config();
const logger = new Logger('TestGenerationRun');

async function testRun() {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/schedulai';
        await mongoose.connect(mongoUri);
        logger.info('Connected to MongoDB');

        // Get active semesters that have assignments
        const semesters = await SemesterModel.find({ isActive: true }).lean();
        const semesterIds = semesters.map((s) => s._id.toString());

        logger.info(`Semesters to generate: ${semesters.map(s => `${s.name} (${s._id})`).join(', ')}`);

        const service = new GenerationService();
        const mockUser: any = {
            _id: new mongoose.Types.ObjectId(),
            name: 'System Diagnostic User',
        };

        logger.info('Calling GenerationService.generate...');
        const result = await service.generate({
            name: 'Diagnostic Test Run',
            semesterIds,
        }, mockUser);

        logger.info('Generation completed successfully!');
        logger.info(`Result: ${JSON.stringify(result)}`);

        await mongoose.connection.close();
    } catch (error: any) {
        logger.error('Generation service failed with error:');
        logger.error(error.message);
        logger.error(error.stack);
        await mongoose.connection.close();
        process.exit(1);
    }
}

testRun();
