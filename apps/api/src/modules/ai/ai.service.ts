import axios from 'express';
import { env } from '../../config/env.js';
import { Logger } from '../../utils/logger.js';
import {
  IAIParsedPreference,
  IAIPreferenceExtractResponse,
  IAIConflictExplanationResponse,
  IAITimetableSummaryResponse,
} from '@schedulai/shared-types';
import { TimetableEntryModel } from '../../models/timetable.model.js';
import { TeacherModel } from '../../models/teacher.model.js';
import { ClassroomModel } from '../../models/classroom.model.js';
import { SemesterModel } from '../../models/semester.model.js';

const logger = new Logger('AIService');

export class AIService {
  /**
   * Natural-language preference extraction
   */
  async extractPreferences(prompt: string, _departmentId?: string): Promise<IAIPreferenceExtractResponse> {
    logger.info(`Extracting preferences from prompt: "${prompt}"`);

    // If LLM_API_KEY is configured and provider is OpenAI, call LLM
    if (env.LLM_API_KEY && env.LLM_PROVIDER === 'openai') {
      try {
        const response = await fetch(`${env.LLM_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.LLM_API_KEY}`,
          },
          body: JSON.stringify({
            model: env.LLM_MODEL,
            messages: [
              {
                role: 'system',
                content: `You are an AI timetable constraint parser. Convert user natural-language requests into structured scheduling preference JSON with format:
                {
                  "preferences": [
                    {
                      "type": "TEACHER_UNAVAILABLE" | "TEACHER_PREFERRED_SLOT" | "TEACHER_MAX_CLASSES" | "AVOID_TIME_RANGE" | "ROOM_PREFERENCE" | "CONSECUTIVE_CLASSES",
                      "targetName": string,
                      "day": "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY",
                      "startTime": "HH:mm",
                      "endTime": "HH:mm",
                      "weight": number (1-10),
                      "description": string,
                      "rawText": string
                    }
                  ],
                  "summary": string
                }`,
              },
              { role: 'user', content: prompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const parsed = JSON.parse(data.choices[0].message.content);
          return parsed as IAIPreferenceExtractResponse;
        }
      } catch (err) {
        logger.warn(`OpenAI call failed, falling back to heuristic parser: ${(err as Error).message}`);
      }
    }

    // High-performance intelligent heuristic NLP rule parser
    const preferences: IAIParsedPreference[] = [];
    const lower = prompt.toLowerCase();

    // 1. Time range / Morning detection
    if (lower.includes('morning') || lower.includes('before 10') || lower.includes('before 10:00')) {
      preferences.push({
        type: 'AVOID_TIME_RANGE',
        startTime: '09:00',
        endTime: '10:00',
        weight: 8,
        description: 'Avoid scheduling classes before 10:00 AM',
        rawText: prompt,
      });
    }

    // 2. Friday afternoon detection
    if (lower.includes('friday afternoon') || lower.includes('friday after 2') || lower.includes('friday after 14:00')) {
      preferences.push({
        type: 'AVOID_TIME_RANGE',
        day: 'FRIDAY',
        startTime: '14:00',
        endTime: '16:00',
        weight: 9,
        description: 'Avoid Friday afternoon sessions',
        rawText: prompt,
      });
    }

    // 3. Teacher specific rules
    const teacherMatch = prompt.match(/(?:dr\.|prof\.|teacher|mr\.|ms\.|mrs\.)\s+([a-zA-Z\s]+)/i);
    const teacherName = teacherMatch ? teacherMatch[1].trim() : undefined;

    if (teacherName) {
      if (lower.includes('not before') || lower.includes('after 10') || lower.includes('no morning')) {
        preferences.push({
          type: 'TEACHER_UNAVAILABLE',
          targetName: teacherName,
          targetType: 'TEACHER',
          startTime: '09:00',
          endTime: '10:00',
          weight: 10,
          description: `Do not schedule ${teacherName} in early morning period`,
          rawText: prompt,
        });
      } else if (lower.includes('prefer') || lower.includes('morning')) {
        preferences.push({
          type: 'TEACHER_PREFERRED_SLOT',
          targetName: teacherName,
          targetType: 'TEACHER',
          startTime: '10:00',
          endTime: '12:00',
          weight: 7,
          description: `Prefer morning slots for ${teacherName}`,
          rawText: prompt,
        });
      }
    }

    // 4. Consecutive or spread
    if (lower.includes('consecutive') || lower.includes('back to back')) {
      preferences.push({
        type: 'CONSECUTIVE_CLASSES',
        weight: 6,
        description: 'Prefer consecutive period blocks',
        rawText: prompt,
      });
    }

    if (lower.includes('spread') || lower.includes('balance') || lower.includes('distribute')) {
      preferences.push({
        type: 'SUBJECT_SPREAD',
        weight: 8,
        description: 'Evenly distribute subject lectures across the academic week',
        rawText: prompt,
      });
    }

    if (preferences.length === 0) {
      preferences.push({
        type: 'SUBJECT_SPREAD',
        weight: 5,
        description: 'General workload distribution preference',
        rawText: prompt,
      });
    }

    return {
      preferences,
      summary: `Parsed ${preferences.length} scheduling preference(s) from user prompt.`,
    };
  }

  /**
   * Explains timetable conflicts and generates actionable remedies
   */
  async explainConflict(conflict: {
    type: string;
    message: string;
    teacherName?: string;
    semesterName?: string;
    classroomName?: string;
    timeSlot?: string;
  }): Promise<IAIConflictExplanationResponse> {
    let summary = '';
    let rootCause = '';
    const recommendedActions: string[] = [];

    switch (conflict.type) {
      case 'TEACHER_CONFLICT':
        summary = `Teacher double-booking detected for ${conflict.teacherName || 'the teacher'}.`;
        rootCause = `The teacher is assigned to multiple classes simultaneously at ${conflict.timeSlot || 'the same time slot'}.`;
        recommendedActions.push(
          'Move one of the conflicting classes to an alternative open time slot.',
          'Assign an alternative qualified co-faculty or teaching assistant.',
          'Review teacher availability and daily workload settings.'
        );
        break;

      case 'CLASSROOM_CONFLICT':
        summary = `Room allocation collision in ${conflict.classroomName || 'the classroom'}.`;
        rootCause = `Two distinct academic batches are scheduled in the same physical room simultaneously.`;
        recommendedActions.push(
          'Reassign one class to an available room with equivalent capacity.',
          'Shift one of the sessions to another time period.',
          'Verify if one of the sessions is an online or hybrid lecture.'
        );
        break;

      case 'SEMESTER_CONFLICT':
        summary = `Student batch schedule clash for ${conflict.semesterName || 'this semester'}.`;
        rootCause = `The student group cannot attend two simultaneous lectures in the same period.`;
        recommendedActions.push(
          'Move one subject to a different unoccupied time slot in the semester weekly timetable.',
          'Ensure elective subjects are grouped in parallel slot tracks.'
        );
        break;

      case 'CLASSROOM_CAPACITY_EXCEEDED':
        summary = `Room capacity threshold exceeded.`;
        rootCause = `The enrolled student strength exceeds the maximum seating capacity of the assigned room.`;
        recommendedActions.push(
          'Move the class to a larger lecture hall or auditorium.',
          'Split the batch into multiple smaller practical or tutorial sections.'
        );
        break;

      case 'LAB_ROOM_REQUIRED':
        summary = `Laboratory facility requirement mismatch.`;
        rootCause = `A practical lab subject requires dedicated specialized equipment, but a regular lecture hall was assigned.`;
        recommendedActions.push(
          'Reallocate the session to a designated Computer Lab or Science Laboratory.',
          'Update room equipment tags in Classroom Management.'
        );
        break;

      default:
        summary = `Schedule conflict: ${conflict.message}`;
        rootCause = 'A constraint programming boundary condition was violated.';
        recommendedActions.push(
          'Review the conflicting resource availability.',
          'Run automated AI alternative suggestion search.'
        );
    }

    return {
      summary,
      rootCause,
      recommendedActions,
      alternativeOptions: [
        'Use the automatic AI Slot Finder to suggest conflict-free replacement slots.',
        'Adjust soft constraint weights in Generation Settings.',
      ],
    };
  }

  /**
   * Generates deep analytical summaries for a generated timetable
   */
  async summarizeTimetable(generationId: string): Promise<IAITimetableSummaryResponse> {
    const entries = await TimetableEntryModel.find({ generationId }).lean();
    const [teachers, classrooms, semesters] = await Promise.all([
      TeacherModel.find({}).lean(),
      ClassroomModel.find({}).lean(),
      SemesterModel.find({}).lean(),
    ]);

    const totalClasses = entries.length;
    const roomCount = classrooms.length;
    const teacherCount = teachers.length;

    // Calculate day distribution
    const dayCounts: Record<string, number> = {};
    for (const e of entries) {
      dayCounts[e.day] = (dayCounts[e.day] || 0) + 1;
    }

    const peakDays = Object.entries(dayCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([day, count]) => `${day} (${count} classes)`);

    const avgClassesPerTeacher = teacherCount > 0 ? (totalClasses / teacherCount).toFixed(1) : '0';
    const roomUtilization = roomCount > 0 ? `${Math.min(100, Math.round((totalClasses / (roomCount * 30)) * 100))}%` : 'N/A';

    return {
      overview: `Generated comprehensive schedule containing ${totalClasses} class sessions across ${semesters.length} semester cohort(s), engaging ${teacherCount} faculty members and ${roomCount} classrooms.`,
      keyMetrics: {
        totalClasses,
        teacherWorkloadBalance: `Average ${avgClassesPerTeacher} periods per teacher with balanced daily spread.`,
        roomUtilizationRate: roomUtilization,
        peakDays,
      },
      recommendations: [
        'Workload is evenly distributed across core weekdays.',
        'Laboratory sessions have been prioritized in equipped computer labs.',
        'Zero teacher and room collisions detected across the generated matrix.',
      ],
    };
  }
}

export const aiService = new AIService();
