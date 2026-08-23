import mongoose, { Document, Schema, Model } from 'mongoose';
import { DayOfWeek } from '@schedulai/shared-types';

export interface ITeacherDocument extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  designation: string;
  departmentId: mongoose.Types.ObjectId;
  employeeId: string;
  subjects: mongoose.Types.ObjectId[];
  availability: DayOfWeek[];
  preferredTimeSlots: mongoose.Types.ObjectId[];
  unavailableTimeSlots: mongoose.Types.ObjectId[];
  maxClassesPerDay: number;
  maxClassesPerWeek: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TeacherSchema = new Schema<ITeacherDocument>(
  {
    name: {
      type: String,
      required: [true, 'Teacher name is required'],
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    designation: {
      type: String,
      required: [true, 'Designation is required'],
      trim: true,
      default: 'Assistant Professor',
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department is required'],
      index: true,
    },
    employeeId: {
      type: String,
      required: [true, 'Employee ID is required'],
      unique: true,
      trim: true,
      index: true,
    },
    subjects: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Subject',
      },
    ],
    availability: {
      type: [String],
      enum: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
      default: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
    },
    preferredTimeSlots: [
      {
        type: Schema.Types.ObjectId,
        ref: 'TimeSlot',
      },
    ],
    unavailableTimeSlots: [
      {
        type: Schema.Types.ObjectId,
        ref: 'TimeSlot',
      },
    ],
    maxClassesPerDay: {
      type: Number,
      default: 4,
      min: 1,
      max: 10,
    },
    maxClassesPerWeek: {
      type: Number,
      default: 20,
      min: 1,
      max: 40,
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

export const TeacherModel: Model<ITeacherDocument> =
  mongoose.models.Teacher || mongoose.model<ITeacherDocument>('Teacher', TeacherSchema);
