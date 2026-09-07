import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { GenerationModel } from '../models/generation.model.js';
import { SemesterModel } from '../models/semester.model.js';
import { Logger } from '../utils/logger.js';

dotenv.config();
const logger = new Logger('CheckGenerations');

async function checkGenerations() {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/schedulai';
        await mongoose.connect(mongoUri);
        logger.info('Connected to MongoDB');

        const generations = await GenerationModel.find({})
            .sort({ createdAt: -1 })
            .lean();

        logger.info(`Found ${generations.length} generations in database:`);
        for (const gen of generations) {
            logger.info(`Generation Name: "${gen.name}"`);
            logger.info(`  ID: ${gen._id}`);
            logger.info(`  Status: ${gen.status}`);
            logger.info(`  Version: ${gen.version}`);
            logger.info(`  Created At: ${gen.createdAt}`);
            logger.info(`  Error: ${gen.errorMessage}`);
            logger.info(`  Violations count: ${gen.violations?.length || 0}`);
            logger.info(`  Semesters: ${gen.semesterIds.join(', ')}`);
            if (gen.violations && gen.violations.length > 0) {
                logger.info(`  Violations: ${JSON.stringify(gen.violations)}`);
            }
        }

        await mongoose.connection.close();
    } catch (error) {
        logger.error('Failed to query generations:', error);
        process.exit(1);
    }
}

checkGenerations();
