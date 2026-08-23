import mongoose, { Document, Schema, Model } from 'mongoose';
import { GenerationStatus, IHardConstraints, ISoftConstraints } from '@schedulai/shared-types';

export interface IGenerationDocument extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  status: GenerationStatus;
  semesterIds: mongoose.Types.ObjectId[];
  departmentId?: mongoose.Types.ObjectId;
  academicYear?: string;
  startedAt: Date;
  completedAt?: Date;
  constraints: IHardConstraints;
  preferences: ISoftConstraints;
  resultCount: number;
  score: number;
  errorMessage?: string;
  violations: unknown[];
  statistics: Record<string, unknown>;
  createdBy: mongoose.Types.ObjectId;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const GenerationSchema = new Schema<IGenerationDocument>(
  {
    name: {
      type: String,
      required: [true, 'Generation name is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    semesterIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Semester',
      },
    ],
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    academicYear: {
      type: String,
      trim: true,
      default: '',
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    constraints: {
      type: Schema.Types.Mixed,
      default: {},
    },
    preferences: {
      type: Schema.Types.Mixed,
      default: {},
    },
    resultCount: {
      type: Number,
      default: 0,
    },
    score: {
      type: Number,
      default: 0,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    violations: {
      type: Schema.Types.Mixed,
      default: [],
    },
    statistics: {
      type: Schema.Types.Mixed,
      default: {},
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    version: {
      type: Number,
      default: 1,
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

export const GenerationModel: Model<IGenerationDocument> =
  mongoose.models.Generation ||
  mongoose.model<IGenerationDocument>('Generation', GenerationSchema);
