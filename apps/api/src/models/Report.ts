import { Schema, model, Document, Types } from 'mongoose';
import {
  CATEGORY_VALUES,
  Category,
  STATUS_VALUES,
  Status,
  PRIORITY_VALUES,
  Priority,
  CATEGORY_DECISION_VALUES,
  CategoryDecision,
} from './enums.js';

export interface ILocation {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface IStatusHistory {
  fromStatus: Status | null;
  toStatus: Status;
  changedBy: Types.ObjectId | string;
  note?: string;
  changedAt: Date;
}

export interface IReport extends Document {
  reportNumber: string;
  createdBy: Types.ObjectId;
  title: string;
  description: string;
  category: Category;
  aiSuggestedCategory: Category | null;
  aiConfidence: number | null;
  aiModelVersion: string | null;
  categoryDecision: CategoryDecision;
  status: Status;
  priority: Priority;
  location?: ILocation;
  locationLabel?: string;
  photoKey?: string;
  resolutionNote?: string;
  rejectionReason?: string;
  statusHistory: IStatusHistory[];
  isDemoData: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const LocationSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator(val: number[]) {
          if (!Array.isArray(val) || val.length !== 2) return false;
          const [lng, lat] = val;
          return (
            typeof lng === 'number' &&
            typeof lat === 'number' &&
            !isNaN(lng) &&
            !isNaN(lat) &&
            lng >= -180 &&
            lng <= 180 &&
            lat >= -90 &&
            lat <= 90
          );
        },
        message:
          'Coordinates must be [longitude, latitude] with longitude between -180 and 180 and latitude between -90 and 90',
      },
    },
  },
  { _id: false },
);

const StatusHistorySchema = new Schema(
  {
    fromStatus: {
      type: String,
      enum: [...STATUS_VALUES, null],
      default: null,
    },
    toStatus: {
      type: String,
      required: [true, 'toStatus is required in statusHistory'],
      enum: {
        values: STATUS_VALUES,
        message: '{VALUE} is not a valid status',
      },
    },
    changedBy: {
      type: Schema.Types.Mixed,
      required: [true, 'changedBy is required in statusHistory'],
    },
    note: {
      type: String,
      trim: true,
      validate: {
        validator(val?: string) {
          if (!val) return true;
          return val.length >= 10 && val.length <= 500;
        },
        message: 'Status note must be between 10 and 500 characters',
      },
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const ReportSchema = new Schema<IReport>(
  {
    reportNumber: {
      type: String,
      required: [true, 'reportNumber is required'],
      unique: true,
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'createdBy User reference is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [5, 'Title must be at least 5 characters'],
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      minlength: [20, 'Description must be at least 20 characters'],
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: CATEGORY_VALUES,
        message: '{VALUE} is not a valid category',
      },
    },
    aiSuggestedCategory: {
      type: String,
      enum: [...CATEGORY_VALUES, null],
      default: null,
    },
    aiConfidence: {
      type: Number,
      min: [0, 'aiConfidence cannot be less than 0'],
      max: [1, 'aiConfidence cannot exceed 1'],
      default: null,
    },
    aiModelVersion: {
      type: String,
      default: null,
    },
    categoryDecision: {
      type: String,
      enum: {
        values: CATEGORY_DECISION_VALUES,
        message: '{VALUE} is not a valid categoryDecision',
      },
      default: 'manual_fallback',
    },
    status: {
      type: String,
      enum: {
        values: STATUS_VALUES,
        message: '{VALUE} is not a valid status',
      },
      default: 'submitted',
    },
    priority: {
      type: String,
      enum: {
        values: PRIORITY_VALUES,
        message: '{VALUE} is not a valid priority',
      },
      default: 'normal',
    },
    location: {
      type: LocationSchema,
      default: undefined,
    },
    locationLabel: {
      type: String,
      trim: true,
      maxlength: [120, 'locationLabel cannot exceed 120 characters'],
    },
    photoKey: {
      type: String,
      trim: true,
    },
    resolutionNote: {
      type: String,
      trim: true,
      validate: {
        validator(val?: string) {
          if (!val) return true;
          return val.length >= 10 && val.length <= 500;
        },
        message: 'Resolution note must be between 10 and 500 characters',
      },
    },
    rejectionReason: {
      type: String,
      trim: true,
      validate: {
        validator(val?: string) {
          if (!val) return true;
          return val.length >= 10 && val.length <= 500;
        },
        message: 'Rejection reason must be between 10 and 500 characters',
      },
    },
    statusHistory: {
      type: [StatusHistorySchema],
      default: [],
    },
    isDemoData: {
      type: Boolean,
      default: false,
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
    toObject: {
      transform(_doc, ret) {
        delete (ret as Record<string, unknown>).__v;
        return ret;
      },
    },
  },
);

// Indexes required by Section 2 and 4 of playbook:
// (Note: unique index on reportNumber is declared on the field definition)

// 1. Compound index for "My Reports" (newest first for a user)
ReportSchema.index({ createdBy: 1, createdAt: -1 });

// 3. Compound index for reviewer queue filtering
ReportSchema.index({ status: 1, category: 1, createdAt: -1 });

// 4. 2dsphere index for nearby duplicate suggestions
ReportSchema.index({ location: '2dsphere' }, { sparse: true });

export const Report = model<IReport>('Report', ReportSchema);
