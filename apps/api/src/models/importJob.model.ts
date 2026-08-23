import mongoose, { Document, Schema, Model } from 'mongoose';
import { ImportJobStatus, ImportType, IImportError } from '@schedulai/shared-types';

export interface IImportJobDocument extends Document {
  _id: mongoose.Types.ObjectId;
  type: ImportType;
  fileName: string;
  status: ImportJobStatus;
  progress: number;
  totalRows: number;
  processedRows: number;
  successRows: number;
  errorRows: number;
  rowErrors: IImportError[];
  createdBy: mongoose.Types.ObjectId;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ImportJobSchema = new Schema<IImportJobDocument>(
  {
    type: {
      type: String,
      enum: ['TEACHERS', 'SUBJECTS', 'CLASSROOMS', 'SEMESTERS', 'TIMESLOTS', 'ASSIGNMENTS', 'TIMETABLE'],
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    totalRows: {
      type: Number,
      default: 0,
    },
    processedRows: {
      type: Number,
      default: 0,
    },
    successRows: {
      type: Number,
      default: 0,
    },
    errorRows: {
      type: Number,
      default: 0,
    },
    rowErrors: {
      type: [
        {
          row: Number,
          field: String,
          message: String,
          value: Schema.Types.Mixed,
        },
      ],
      default: [],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
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

export const ImportJobModel: Model<IImportJobDocument> =
  mongoose.models.ImportJob ||
  mongoose.model<IImportJobDocument>('ImportJob', ImportJobSchema);
