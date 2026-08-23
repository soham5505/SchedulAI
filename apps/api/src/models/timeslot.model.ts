import mongoose, { Document, Schema, Model } from 'mongoose';
import { DayOfWeek } from '@schedulai/shared-types';

export interface ITimeSlotDocument extends Document {
  _id: mongoose.Types.ObjectId;
  day: DayOfWeek;
  startTime: string;
  endTime: string;
  periodNumber: number;
  isBreak: boolean;
  isActive: boolean;
  label?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TimeSlotSchema = new Schema<ITimeSlotDocument>(
  {
    day: {
      type: String,
      enum: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
      required: [true, 'Day is required'],
      index: true,
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required'],
      trim: true,
    },
    endTime: {
      type: String,
      required: [true, 'End time is required'],
      trim: true,
    },
    periodNumber: {
      type: Number,
      required: [true, 'Period number is required'],
      min: 1,
      max: 20,
    },
    isBreak: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    label: {
      type: String,
      trim: true,
      default: '',
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

TimeSlotSchema.index({ day: 1, startTime: 1, endTime: 1 }, { unique: true });
TimeSlotSchema.index({ day: 1, periodNumber: 1 });

export const TimeSlotModel: Model<ITimeSlotDocument> =
  mongoose.models.TimeSlot || mongoose.model<ITimeSlotDocument>('TimeSlot', TimeSlotSchema);
