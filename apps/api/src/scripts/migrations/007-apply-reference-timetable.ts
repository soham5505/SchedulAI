import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { DAYS_OF_WEEK, STANDARD_PERIOD_TIMES } from '@schedulai/config';
import { connectDatabase, disconnectDatabase } from '../../config/database.js';
import { TeachingAssignmentModel } from '../../models/assignment.model.js';
import { SubjectModel } from '../../models/subject.model.js';
import { SemesterModel } from '../../models/semester.model.js';
import { BatchModel } from '../../models/batch.model.js';
import { TeacherModel } from '../../models/teacher.model.js';
import { ClassroomModel } from '../../models/classroom.model.js';
import { TimeSlotModel } from '../../models/timeslot.model.js';

const DRY_RUN = process.env.DRY_RUN !== 'false';
const TARGET_SEMESTER = /\bSEM\s*(3|5|7)\b/i;

function isLab(subject: any, assignment?: any): boolean {
  return Boolean(
    assignment?.isLab ||
    subject?.isLab ||
    /^ITL/i.test(String(subject?.code || '')) ||
    /\bLAB\b/i.test(String(subject?.name || ''))
  );
}

async function migrate(): Promise<void> {
  await connectDatabase();
  if (mongoose.connection.readyState !== 1) throw new Error('Database connection unavailable');

  const [allSemesters, allBatches, allAssignments, allSubjects, allTeachers, allClassrooms, allTimeSlots] = await Promise.all([
    SemesterModel.find({ isActive: true }).lean(),
    BatchModel.find({ isActive: true }).lean(),
    TeachingAssignmentModel.find({}).lean(),
    SubjectModel.find({}).lean(),
    TeacherModel.find({ isActive: true }).lean(),
    ClassroomModel.find({ isAvailable: true }).lean(),
    TimeSlotModel.find({}).lean(),
  ]);

  const semesters = allSemesters.filter((semester) => TARGET_SEMESTER.test(semester.name));
  const semesterIds = new Set(semesters.map((semester) => semester._id.toString()));
  const levels = new Set(semesters.map((semester) => Number(semester.name.match(TARGET_SEMESTER)?.[1])));
  if (![3, 5, 7].every((level) => levels.has(level))) {
    throw new Error(`Expected active SEM 3, SEM 5, and SEM 7; found levels ${Array.from(levels).join(', ')}`);
  }

  const batches = allBatches.filter((batch) => semesterIds.has(batch.semesterId.toString()));
  const batchById = new Map(batches.map((batch) => [batch._id.toString(), batch]));
  for (const semester of semesters) {
    const codes = batches.filter((batch) => batch.semesterId.toString() === semester._id.toString()).map((batch) => batch.code);
    if (codes.length !== 4 || !['B1', 'B2', 'B3', 'B4'].every((code) => codes.includes(code))) {
      throw new Error(`${semester.name} must have exactly active batches B1, B2, B3, and B4; found ${codes.join(', ')}`);
    }
  }

  const assignments = allAssignments.filter((assignment) => semesterIds.has(assignment.semesterId.toString()));
  const subjectById = new Map(allSubjects.map((subject) => [subject._id.toString(), subject]));
  const teacherIds = new Set(allTeachers.map((teacher) => teacher._id.toString()));
  const classroomById = new Map(allClassrooms.map((classroom) => [classroom._id.toString(), classroom]));
  const subjectIds = new Set(assignments.map((assignment) => assignment.subjectId.toString()));
  const subjects = allSubjects.filter((subject) => subjectIds.has(subject._id.toString()));

  const groups = new Map<string, typeof assignments>();
  for (const assignment of assignments) {
    const key = `${assignment.semesterId}|${assignment.subjectId}`;
    groups.set(key, [...(groups.get(key) || []), assignment]);
  }
  for (const [key, group] of groups) {
    const subject = subjectById.get(group[0].subjectId.toString());
    if (!subject) throw new Error(`Assignment group ${key} has a missing subject`);
    if (group.some((assignment) => !teacherIds.has(assignment.teacherId.toString()))) {
      throw new Error(`Assignment group ${key} has a stale teacher reference; repair it before migrating`);
    }
    if (isLab(subject, group[0])) {
      const codes = group.map((assignment) => {
        if (!assignment.batchId) throw new Error(`Lab assignment ${assignment._id} has no batch`);
        const batch = batchById.get(assignment.batchId.toString());
        if (!batch || batch.semesterId.toString() !== assignment.semesterId.toString()) {
          throw new Error(`Lab assignment ${assignment._id} references a missing or mismatched batch`);
        }
        return batch.code;
      });
      if (group.length !== 4 || new Set(codes).size !== 4 || !['B1', 'B2', 'B3', 'B4'].every((code) => codes.includes(code))) {
        throw new Error(`Lab subject ${subject.name} must have exactly one assignment for each batch B1-B4`);
      }
    } else if (group.length !== 1) {
      throw new Error(`Lecture subject ${subject.name} has ${group.length} assignments; keep exactly one whole-semester assignment`);
    }
  }

  const expectedTeaching = STANDARD_PERIOD_TIMES.filter((slot) => !slot.isBreak);
  const expectedKeys = new Set(
    DAYS_OF_WEEK.flatMap((day) => expectedTeaching.map((slot) => `${day}|${slot.period}|${slot.startTime}|${slot.endTime}`))
  );
  const activeTeaching = allTimeSlots.filter((slot) => slot.isActive && !slot.isBreak);
  const staleActiveSlots = activeTeaching.filter((slot) => !expectedKeys.has(`${slot.day}|${slot.periodNumber}|${slot.startTime}|${slot.endTime}`));
  const mismatchedAssignments = assignments.filter((assignment) => {
    const subject = subjectById.get(assignment.subjectId.toString());
    return assignment.periodsPerWeek !== (isLab(subject, assignment) ? 2 : 3) || assignment.isLab !== isLab(subject, assignment);
  });
  const mismatchedSubjects = subjects.filter((subject) => {
    const lab = isLab(subject);
    return subject.weeklyPeriods !== (lab ? 2 : 3) || subject.lecturePeriods !== (lab ? 0 : 3) || subject.labPeriods !== (lab ? 2 : 0) || subject.isLab !== lab;
  });
  const invalidRooms = assignments.filter((assignment) => {
    if (!assignment.classroomId) return false;
    const subject = subjectById.get(assignment.subjectId.toString());
    const room = classroomById.get(assignment.classroomId.toString());
    const lab = isLab(subject, assignment);
    return !room || (lab ? !room.isLab || room.capacity < 20 : room.isLab || room.capacity < 80);
  });

  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log(`Target semesters: ${semesters.length}; batches: ${batches.length}`);
  console.log(`Assignments to normalize: ${mismatchedAssignments.length}`);
  console.log(`Subjects to normalize: ${mismatchedSubjects.length}`);
  console.log(`Reference time slots: ${DAYS_OF_WEEK.length * STANDARD_PERIOD_TIMES.length} total (${DAYS_OF_WEEK.length * expectedTeaching.length} teaching)`);
  console.log(`Active non-reference teaching slots to deactivate: ${staleActiveSlots.length}`);
  console.log(`Assignments with stale/incompatible fixed rooms to clear: ${invalidRooms.length}`);

  if (DRY_RUN) return;

  const backupDir = path.resolve(process.cwd(), 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `reference-timetable-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(
    backupPath,
    JSON.stringify({ semesters, batches, assignments, subjects, timeslots: allTimeSlots }, null, 2),
    'utf8'
  );
  console.log(`Backup: ${backupPath}`);

  for (const assignment of assignments) {
    const subject = subjectById.get(assignment.subjectId.toString())!;
    const lab = isLab(subject, assignment);
    const room = assignment.classroomId ? classroomById.get(assignment.classroomId.toString()) : null;
    const roomIsValid = Boolean(room && (lab ? room.isLab && room.capacity >= 20 : !room.isLab && room.capacity >= 80));
    await TeachingAssignmentModel.updateOne(
      { _id: assignment._id },
      {
        $set: {
          periodsPerWeek: lab ? 2 : 3,
          isLab: lab,
          ...(!lab ? { batchId: null } : {}),
          ...(!roomIsValid && assignment.classroomId ? { classroomId: null } : {}),
        },
      }
    );
  }

  for (const subject of subjects) {
    const lab = isLab(subject);
    await SubjectModel.updateOne(
      { _id: subject._id },
      {
        $set: {
          isLab: lab,
          weeklyPeriods: lab ? 2 : 3,
          lecturePeriods: lab ? 0 : 3,
          labPeriods: lab ? 2 : 0,
        },
      }
    );
  }

  const activeIds: mongoose.Types.ObjectId[] = [];
  for (const day of DAYS_OF_WEEK) {
    for (const slot of STANDARD_PERIOD_TIMES) {
      const existing = await TimeSlotModel.findOne({ day, startTime: slot.startTime, endTime: slot.endTime });
      const values = {
        day,
        startTime: slot.startTime,
        endTime: slot.endTime,
        periodNumber: slot.period,
        isBreak: Boolean(slot.isBreak),
        label: slot.label || `Period ${slot.period}`,
        isActive: true,
      };
      if (existing) {
        Object.assign(existing, values);
        await existing.save();
        activeIds.push(existing._id);
      } else {
        const created = await TimeSlotModel.create(values);
        activeIds.push(created._id);
      }
    }
  }

  await TimeSlotModel.updateMany(
    { _id: { $nin: activeIds }, isActive: true },
    { $set: { isActive: false } }
  );
  console.log('Reference timetable migration completed.');
}

migrate()
  .catch((error) => {
    console.error('Reference timetable migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
