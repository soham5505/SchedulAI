import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IBatchDocument extends Document {
  _id: mongoose.Types.ObjectId;
  semesterId: mongoose.Types.ObjectId;
  code: string;
  studentCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BatchSchema = new Schema<IBatchDocument>(
  {
    semesterId: {
      type: Schema.Types.ObjectId,
      ref: 'Semester',
      required: [true, 'Semester is required'],
      index: true,
    },
    code: {
      type: String,
      required: [true, 'Batch code is required'],
      trim: true,
      uppercase: true,
      minlength: 1,
      maxlength: 20,
      match: [/^[A-Z0-9][A-Z0-9_-]*$/, 'Batch code may contain only letters, numbers, hyphens, and underscores'],
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

BatchSchema.index({ semesterId: 1, code: 1 }, { unique: true });

export const BatchModel: Model<IBatchDocument> =
  mongoose.models.Batch || mongoose.model<IBatchDocument>('Batch', BatchSchema);