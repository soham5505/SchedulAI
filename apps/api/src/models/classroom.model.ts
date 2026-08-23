import mongoose, { Document, Schema, Model } from 'mongoose';
import { RoomType } from '@schedulai/shared-types';

export interface IClassroomDocument extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  building: string;
  roomNumber: string;
  capacity: number;
  type: RoomType;
  equipment: string[];
  isLab: boolean;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ClassroomSchema = new Schema<IClassroomDocument>(
  {
    name: {
      type: String,
      required: [true, 'Classroom name is required'],
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    building: {
      type: String,
      required: [true, 'Building is required'],
      trim: true,
      maxlength: 100,
    },
    roomNumber: {
      type: String,
      required: [true, 'Room number is required'],
      trim: true,
      maxlength: 50,
    },
    capacity: {
      type: Number,
      required: [true, 'Capacity is required'],
      min: 1,
      default: 40,
    },
    type: {
      type: String,
      enum: ['LECTURE', 'LAB', 'SEMINAR', 'OTHER'],
      default: 'LECTURE',
    },
    equipment: {
      type: [String],
      default: [],
    },
    isLab: {
      type: Boolean,
      default: false,
    },
    isAvailable: {
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

// Unique compound index for building and roomNumber
ClassroomSchema.index({ building: 1, roomNumber: 1 }, { unique: true });

export const ClassroomModel: Model<IClassroomDocument> =
  mongoose.models.Classroom || mongoose.model<IClassroomDocument>('Classroom', ClassroomSchema);
