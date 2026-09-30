import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { SemesterModel } from '../models/semester.model.js';
import { TeacherModel } from '../models/teacher.model.js';
import { SubjectModel } from '../models/subject.model.js';
import { ClassroomModel } from '../models/classroom.model.js';
import { TimeSlotModel } from '../models/timeslot.model.js';
import { TeachingAssignmentModel } from '../models/assignment.model.js';
import { BatchModel } from '../models/batch.model.js';
import { Logger } from '../utils/logger.js';
import { DEFAULT_HARD_CONSTRAINTS, DEFAULT_SOFT_CONSTRAINTS } from '@schedulai/config';

dotenv.config();
const logger = new Logger('DumpGeneratorPayload');

async function dumpPayload() {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/schedulai';
        await mongoose.connect(mongoUri);
        logger.info('Connected to MongoDB');

        // Get active semesters that have assignments
        const assignmentsList = await TeachingAssignmentModel.find({}).lean();
        const semesterIds = Array.from(new Set(assignmentsList.map((a: any) => a.semesterId.toString())));

        logger.info(`Found semester IDs with assignments: ${semesterIds.join(', ')}`);

        const semesterObjectIds = semesterIds.map((id) => new mongoose.Types.ObjectId(id));

        // Fetch relevant academic data from MongoDB
        const [semesters, classrooms, timeslots, assignments, batches, teachersDb, subjectsDb] = await Promise.all([
            SemesterModel.find({ _id: { $in: semesterObjectIds }, isActive: true }).lean(),
            ClassroomModel.find({ isAvailable: true }).lean(),
            TimeSlotModel.find({ isActive: true, isBreak: false }).lean(),
            TeachingAssignmentModel.find({ semesterId: { $in: semesterObjectIds } }).lean(),
            BatchModel.find({ semesterId: { $in: semesterObjectIds }, isActive: true }).lean(),
            TeacherModel.find({}).lean(),
            SubjectModel.find({}).lean(),
        ]);

        logger.info(`Found ${semesters.length} active semesters`);
        logger.info(`Found ${assignments.length} teaching assignments`);
        logger.info(`Found ${classrooms.length} classrooms`);
        logger.info(`Found ${timeslots.length} timeslots`);
        logger.info(`Found ${batches.length} batches`);

        // Extract unique teachers and subjects from assignments
        const dbTeacherMap = new Map<string, any>(teachersDb.map((t) => [t._id.toString(), t]));
        const dbSubjectMap = new Map<string, any>(subjectsDb.map((s) => [s._id.toString(), s]));

        const teacherMap = new Map<string, any>();
        const subjectMap = new Map<string, any>();

        for (const a of assignments) {
            const tId = String(a.teacherId);
            const sId = String(a.subjectId);
            if (dbTeacherMap.has(tId)) {
                teacherMap.set(tId, dbTeacherMap.get(tId));
            }
            if (dbSubjectMap.has(sId)) {
                subjectMap.set(sId, dbSubjectMap.get(sId));
            }
        }

        const teachers = Array.from(teacherMap.values());
        const subjects = Array.from(subjectMap.values());

        // Format scheduler payload
        const schedulerPayload = {
            teachers: teachers.map((t) => ({
                id: String(t._id),
                name: String(t.name || ''),
                availability: t.availability || ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
                preferredTimeSlots: (t.preferredTimeSlots || []).map((id: any) => String(id)),
                unavailableTimeSlots: (t.unavailableTimeSlots || []).map((id: any) => String(id)),
                maxClassesPerDay: Number(t.maxClassesPerDay) || 4,
                maxClassesPerWeek: Number(t.maxClassesPerWeek) || 20,
                isMaxWeeklySourceDefined: t.isMaxWeeklySourceDefined ?? false,
            })),
            subjects: subjects.map((s) => ({
                id: String(s._id),
                name: String(s.name || ''),
                code: String(s.code || ''),
                weeklyPeriods: Number(s.weeklyPeriods) || 4,
                lecturePeriods: s.lecturePeriods !== undefined ? Number(s.lecturePeriods) : 3,
                labPeriods: s.labPeriods !== undefined ? Number(s.labPeriods) : 2,
                isLab: Boolean(s.isLab),
            })),
            classrooms: classrooms.map((c) => ({
                id: c._id.toString(),
                name: `${c.building} - ${c.roomNumber} (${c.name})`,
                capacity: c.capacity,
                type: c.type,
                equipment: c.equipment || [],
                isLab: c.isLab || false,
                isAvailable: c.isAvailable,
            })),
            semesters: semesters.map((m) => ({
                id: m._id.toString(),
                name: `${m.name} (${m.section})`,
                studentCount: m.studentCount,
            })),
            batches: batches.map((b) => ({
                id: b._id.toString(),
                semesterId: b.semesterId.toString(),
                code: b.code,
                studentCount: b.studentCount,
            })),
            timeslots: timeslots.map((ts) => ({
                id: ts._id.toString(),
                day: ts.day,
                startTime: ts.startTime,
                endTime: ts.endTime,
                periodNumber: ts.periodNumber,
                isBreak: ts.isBreak,
                isActive: ts.isActive,
            })),
            teachingAssignments: (() => {
                const seen = new Set<string>();
                const deduplicated = assignments
                    .map((a) => {
                        const tObj = a.teacherId as any;
                        const sObj = a.subjectId as any;
                        return {
                            id: a._id.toString(),
                            teacherId: String(tObj._id),
                            subjectId: String(sObj._id),
                            semesterId: a.semesterId.toString(),
                            ...(a.batchId ? { batchId: a.batchId.toString() } : {}),
                            ...(a.classroomId ? { classroomId: a.classroomId.toString() } : {}),
                            classroomRequirements: a.classroomRequirements || [],
                            periodsPerWeek: a.periodsPerWeek,
                            isLab: a.isLab || false,
                            key: `${String(tObj._id)}|${String(sObj._id)}|${a.semesterId.toString()}|${a.batchId?.toString() || 'ALL'}`,
                        };
                    })
                    .filter((a) => {
                        if (seen.has(a.key)) {
                            return false;
                        }
                        seen.add(a.key);
                        return true;
                    })
                    .map(({ key, ...rest }) => rest);

                return deduplicated;
            })(),
            hardConstraints: DEFAULT_HARD_CONSTRAINTS,
            softConstraints: DEFAULT_SOFT_CONSTRAINTS,
            timeLimitSeconds: 60,
        };

        const outPath = path.resolve(process.cwd(), '../../solver_payload.json');
        fs.writeFileSync(outPath, JSON.stringify(schedulerPayload, null, 2), 'utf-8');
        logger.info(`Successfully wrote payload to ${outPath}`);

        await mongoose.connection.close();
    } catch (error) {
        logger.error('Dumping payload failed:', error);
        process.exit(1);
    }
}

dumpPayload();
