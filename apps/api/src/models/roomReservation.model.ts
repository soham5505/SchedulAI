import mongoose, { Document, Schema, Model } from 'mongoose';
import { DayOfWeek } from '@schedulai/shared-types';

export interface IRoomReservationDocument extends Document {
  _id: mongoose.Types.ObjectId;
  classroomId: mongoose.Types.ObjectId;
  departmentId: mongoose.Types.ObjectId;
  dayOfWeek: DayOfWeek;
  startPeriod: number;
  endPeriod: number;
  reason: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RoomReservationSchema = new Schema<IRoomReservationDocument>(
  {
    classroomId: {
      type: Schema.Types.ObjectId,
      ref: 'Classroom',
      required: [true, 'Classroom is required'],
      index: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department is required'],
      index: true,
    },
    dayOfWeek: {
      type: String,
      enum: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
      required: [true, 'Day of week is required'],
    },
    startPeriod: {
      type: Number,
      required: [true, 'Start period is required'],
      min: 1,
      max: 20,
    },
    endPeriod: {
      type: Number,
      required: [true, 'End period is required'],
      min: 1,
      max: 20,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
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

// Compound index for fast lookups by classroom + day
RoomReservationSchema.index({ classroomId: 1, dayOfWeek: 1 });

export const RoomReservationModel: Model<IRoomReservationDocument> =
  mongoose.models.RoomReservation || mongoose.model<IRoomReservationDocument>('RoomReservation', RoomReservationSchema);
