import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Schema as MongooseSchema } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  _id: string;

  @Prop({ required: false })
  name: string;

  @Prop({ required: false, default: '' })
  profileImage?: string;

  @Prop({ required: false, default: false })
  isOnline: boolean;

  @Prop({ default: Date.now, required: false })
  lastSeen: Date;

  @Prop({ required: false })
  email: string;

  @Prop({ required: false })
  mobile: string;

  @Prop({ required: false })
  password: string;

  @Prop({ required: false, default: true })
  status: string;

  @Prop({ required: false })
  userId: number;

  @Prop({ required: false, default: false })
  isDeleted: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Organization' })
  organizationId: Types.ObjectId;

  @Prop({ required: true, enum: ['admin', 'user', 'vendor'] })
  type: 'admin' | 'user' | 'vendor';

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Add pre-hooks
// UserSchema.pre("save", function (next) {
//   if (!this.deletedOn) {
//     this.deletedOn = null;
//   }
//   next();
// });
