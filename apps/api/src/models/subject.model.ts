import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ISubjectDocument extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  code: string;
  credits: number;
  departmentId: mongoose.Types.ObjectId;
  semesterIds: mongoose.Types.ObjectId[];
  weeklyPeriods: number;
  lecturePeriods: number;
  labPeriods: number;
  isLab: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SubjectSchema = new Schema<ISubjectDocument>(
  {
    name: {
      type: String,
      required: [true, 'Subject name is required'],
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    code: {
      type: String,
      required: [true, 'Subject code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 2,
      maxlength: 20,
      index: true,
    },
    credits: {
      type: Number,
      required: true,
      default: 3,
      min: 1,
      max: 10,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department is required'],
      index: true,
    },
    semesterIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Semester',
      },
    ],
    weeklyPeriods: {
      type: Number,
      required: true,
      default: 3,
      min: 1,
      max: 20,
    },
    lecturePeriods: {
      type: Number,
      default: 3,
      min: 0,
      max: 20,
    },
    labPeriods: {
      type: Number,
      default: 0,
      min: 0,
      max: 20,
    },
    isLab: {
      type: Boolean,
      default: false,
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

export const SubjectModel: Model<ISubjectDocument> =
  mongoose.models.Subject || mongoose.model<ISubjectDocument>('Subject', SubjectSchema);
