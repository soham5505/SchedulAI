import mongoose, { Document, Schema, Model } from 'mongoose';
import { DayOfWeek, PeriodType } from '@schedulai/shared-types';

export interface ITimetableEntryDocument extends Document {
  _id: mongoose.Types.ObjectId;
  semesterId: mongoose.Types.ObjectId;
  batchId?: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  classroomId: mongoose.Types.ObjectId;
  timeSlotId: mongoose.Types.ObjectId;
  day: DayOfWeek;
  startTime: string;
  endTime: string;
  periodType: PeriodType;
  generationId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TimetableEntrySchema = new Schema<ITimetableEntryDocument>(
  {
    semesterId: {
      type: Schema.Types.ObjectId,
      ref: 'Semester',
      required: [true, 'Semester is required'],
      index: true,
    },
    batchId: {
      type: Schema.Types.ObjectId,
      ref: 'Batch',
      default: null,
      index: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Subject is required'],
      index: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
      required: [true, 'Teacher is required'],
      index: true,
    },
    classroomId: {
      type: Schema.Types.ObjectId,
      ref: 'Classroom',
      required: [true, 'Classroom is required'],
      index: true,
    },
    timeSlotId: {
      type: Schema.Types.ObjectId,
      ref: 'TimeSlot',
      required: [true, 'Time slot is required'],
      index: true,
    },
    day: {
      type: String,
      enum: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
      required: true,
      index: true,
    },
    startTime: {
      type: String,
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
    periodType: {
      type: String,
      enum: ['LECTURE', 'LAB', 'TUTORIAL', 'SEMINAR'],
      default: 'LECTURE',
    },
    generationId: {
      type: Schema.Types.ObjectId,
      ref: 'Generation',
      required: [true, 'Generation reference is required'],
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete (ret as Record<string, unknown>).__v;
        return ret;
      },
    },
  }
);

TimetableEntrySchema.index({ generationId: 1, semesterId: 1, timeSlotId: 1 });
TimetableEntrySchema.index({ generationId: 1, teacherId: 1, timeSlotId: 1 });
TimetableEntrySchema.index({ generationId: 1, classroomId: 1, timeSlotId: 1 });

export const TimetableEntryModel: Model<ITimetableEntryDocument> =
  mongoose.models.TimetableEntry ||
  mongoose.model<ITimetableEntryDocument>('TimetableEntry', TimetableEntrySchema);
