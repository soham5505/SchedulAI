import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ITeachingAssignmentDocument extends Document {
  _id: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  semesterId: mongoose.Types.ObjectId;
  classroomRequirements: string[];
  periodsPerWeek: number;
  isLab: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TeachingAssignmentSchema = new Schema<ITeachingAssignmentDocument>(
  {
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
      required: [true, 'Teacher is required'],
      index: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Subject is required'],
      index: true,
    },
    semesterId: {
      type: Schema.Types.ObjectId,
      ref: 'Semester',
      required: [true, 'Semester is required'],
      index: true,
    },
    classroomRequirements: {
      type: [String],
      default: [],
    },
    periodsPerWeek: {
      type: Number,
      required: [true, 'Periods per week is required'],
      min: 1,
      max: 20,
      default: 4,
    },
    isLab: {
      type: Boolean,
      default: false,
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

TeachingAssignmentSchema.index(
  { teacherId: 1, subjectId: 1, semesterId: 1 },
  { unique: true }
);

export const TeachingAssignmentModel: Model<ITeachingAssignmentDocument> =
  mongoose.models.TeachingAssignment ||
  mongoose.model<ITeachingAssignmentDocument>('TeachingAssignment', TeachingAssignmentSchema);
