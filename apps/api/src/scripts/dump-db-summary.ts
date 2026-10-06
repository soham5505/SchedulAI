import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import '../models/index.js';
import { SemesterModel } from '../models/semester.model.js';
import { TeachingAssignmentModel } from '../models/assignment.model.js';
import { ClassroomModel } from '../models/classroom.model.js';
import { TimeSlotModel } from '../models/timeslot.model.js';
import { BatchModel } from '../models/batch.model.js';
import { TeacherModel } from '../models/teacher.model.js';
import { SubjectModel } from '../models/subject.model.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/schedulai');
  const collections = await mongoose.connection.db!.listCollections().toArray();
  console.log('\n--- ALL COLLECTIONS IN DATABASE ---');
  for (const c of collections) {
    const count = await mongoose.connection.db!.collection(c.name).countDocuments();
    console.log(`${c.name.padEnd(25)}: ${count}`);
  }

  const semesters = await SemesterModel.find({ isActive: true }).lean();
  const s0 = semesters[0];
  if (s0) {
    const batches = await BatchModel.find({ semesterId: s0._id }).lean();
    console.log(`\nBatches for ${s0.name} ${s0.section}:`, batches.map(b => ({ id: b._id, code: b.code })));
    const asgns = await TeachingAssignmentModel.find({ semesterId: s0._id }).populate('subjectId').populate('batchId').lean();
    console.log(`Assignments for ${s0.name} ${s0.section}:`);
    for (const a of asgns) {
      const sub: any = a.subjectId;
      const b: any = a.batchId;
      console.log(`  [${a.isLab || sub?.isLab ? 'LAB' : 'THY'}] ${sub?.code} (${sub?.name}) | batch: ${b ? b.code : 'NULL'} | periods: ${a.periodsPerWeek}`);
    }
  }

  const classrooms = await ClassroomModel.find({}).lean();
  console.log('\n--- CLASSROOMS ---');
  console.log(`Total: ${classrooms.length}`);
  console.log(`Labs: ${classrooms.filter(c => c.isLab).length}, Lecture rooms: ${classrooms.filter(c => !c.isLab).length}`);
  for (const c of classrooms) {
    console.log(`  Room: ${c.roomNumber} | Name: ${c.name} | isLab: ${c.isLab} | capacity: ${c.capacity} | available: ${c.isAvailable}`);
  }

  const timeslots = await TimeSlotModel.find({}).lean();
  console.log('\n--- TIMESLOTS ---');
  console.log(`Total: ${timeslots.length}, Active & not break: ${timeslots.filter(t => t.isActive && !t.isBreak).length}`);
  const days = [...new Set(timeslots.map(t => t.day))];
  console.log(`Days: ${days.join(', ')}`);

  await mongoose.connection.close();
}

run().catch(console.error);
