import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ISemesterDocument extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  number: number;
  departmentId: mongoose.Types.ObjectId;
  academicYear: string;
  section: string;
  studentCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SemesterSchema = new Schema<ISemesterDocument>(
  {
    name: {
      type: String,
      required: [true, 'Semester name is required'],
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    number: {
      type: Number,
      required: [true, 'Semester number is required'],
      min: 1,
      max: 12,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department is required'],
      index: true,
    },
    academicYear: {
      type: String,
      required: [true, 'Academic year is required'],
      trim: true,
    },
    section: {
      type: String,
      default: 'A',
      trim: true,
    },
    studentCount: {
      type: Number,
      required: [true, 'Student count is required'],
      min: 1,
      default: 30,
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

SemesterSchema.index(
  { departmentId: 1, number: 1, section: 1, academicYear: 1 },
  { unique: true }
);

export const SemesterModel: Model<ISemesterDocument> =
  mongoose.models.Semester || mongoose.model<ISemesterDocument>('Semester', SemesterSchema);
