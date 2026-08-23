import { DepartmentModel } from '../../models/department.model.js';
import { TeacherModel } from '../../models/teacher.model.js';
import { SubjectModel } from '../../models/subject.model.js';
import { ClassroomModel } from '../../models/classroom.model.js';
import { SemesterModel } from '../../models/semester.model.js';
import { GenerationModel } from '../../models/generation.model.js';
import { TimetableEntryModel } from '../../models/timetable.model.js';
import { ImportJobModel } from '../../models/importJob.model.js';
import { TeachingAssignmentModel } from '../../models/assignment.model.js';

export class DashboardService {
  async getStats() {
    const [
      totalDepartments,
      totalTeachers,
      totalSubjects,
      totalClassrooms,
      totalSemesters,
      totalGenerations,
      totalTimetableEntries,
      totalAssignments,
      recentGenerations,
      recentImports,
      classrooms,
      teachers,
    ] = await Promise.all([
      DepartmentModel.countDocuments({ isActive: true }),
      TeacherModel.countDocuments({ isActive: true }),
      SubjectModel.countDocuments({ isActive: true }),
      ClassroomModel.countDocuments({ isAvailable: true }),
      SemesterModel.countDocuments({ isActive: true }),
      GenerationModel.countDocuments({}),
      TimetableEntryModel.countDocuments({}),
      TeachingAssignmentModel.countDocuments({}),
      GenerationModel.find({}).sort({ createdAt: -1 }).limit(5).populate('createdBy', 'name').lean(),
      ImportJobModel.find({}).sort({ createdAt: -1 }).limit(5).populate('createdBy', 'name').lean(),
      ClassroomModel.find({}).lean(),
      TeacherModel.find({}).populate('departmentId', 'name code').lean(),
    ]);

    // Active generation count
    const activeGenerations = await GenerationModel.countDocuments({ status: 'RUNNING' });

    // Classroom type distribution
    const roomTypeCounts: Record<string, number> = {};
    for (const c of classrooms) {
      roomTypeCounts[c.type] = (roomTypeCounts[c.type] || 0) + 1;
    }

    // Teacher department distribution
    const teacherDeptCounts: Record<string, number> = {};
    for (const t of teachers) {
      const dept = t.departmentId as unknown as Record<string, unknown>;
      const code = (dept && (dept.code as string)) || 'General';
      teacherDeptCounts[code] = (teacherDeptCounts[code] || 0) + 1;
    }

    return {
      summary: {
        totalDepartments,
        totalTeachers,
        totalSubjects,
        totalClassrooms,
        totalSemesters,
        totalGenerations,
        totalTimetableEntries,
        totalAssignments,
        activeGenerations,
      },
      recentGenerations,
      recentImports,
      analytics: {
        classroomTypes: roomTypeCounts,
        teachersByDepartment: teacherDeptCounts,
      },
    };
  }
}

export const dashboardService = new DashboardService();
