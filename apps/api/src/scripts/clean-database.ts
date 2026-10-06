import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import '../models/index.js';
import { TimetableEntryModel } from '../models/timetable.model.js';
import { GenerationModel } from '../models/generation.model.js';
import { TeachingAssignmentModel } from '../models/assignment.model.js';
import { SemesterModel } from '../models/semester.model.js';
import { BatchModel } from '../models/batch.model.js';
import { TeacherModel } from '../models/teacher.model.js';
import { SubjectModel } from '../models/subject.model.js';
import { ClassroomModel } from '../models/classroom.model.js';
import { RoomReservationModel } from '../models/roomReservation.model.js';
import { ImportJobModel } from '../models/importJob.model.js';
import { TimeSlotModel } from '../models/timeslot.model.js';
import { timeSlotService } from '../modules/timeslots/timeslot.service.js';
import { DAYS_OF_WEEK } from '@schedulai/config';

dotenv.config();

async function cleanAll() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/schedulai');
  console.log('Connected to MongoDB. Wiping all academic data and timetable entries...');

  const results = await Promise.all([
    TimetableEntryModel.deleteMany({}),
    GenerationModel.deleteMany({}),
    TeachingAssignmentModel.deleteMany({}),
    BatchModel.deleteMany({}),
    SemesterModel.deleteMany({}),
    TeacherModel.deleteMany({}),
    SubjectModel.deleteMany({}),
    ClassroomModel.deleteMany({}),
    RoomReservationModel.deleteMany({}),
    ImportJobModel.deleteMany({}),
  ]);

  console.log('✅ Wiped all orphaned timetable entries, generations, and academic records.');
  
  // Re-generate standard reference time slots so the timetable grid is active
  await timeSlotService.bulkGenerateStandard(DAYS_OF_WEEK);
  const activeSlots = await TimeSlotModel.countDocuments({ isActive: true, isBreak: false });
  console.log(`✅ Standard teaching time slots initialized: ${activeSlots} active slots ready.`);

  await mongoose.connection.close();
  console.log('Done! Database is 100% clean and ready for fresh imports.');
}

cleanAll().catch(console.error);
