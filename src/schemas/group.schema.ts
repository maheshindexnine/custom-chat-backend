import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { User } from './user.schema';
import { Schema as MongooseSchemaSchema } from 'mongoose';
import { Organization } from './organization.schema';

export type GroupDocument = Group & Document;

@Schema({ timestamps: true })
export class Group {
  _id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop()
  profileImage?: string;

  @Prop({ type: [{ type: MongooseSchemaSchema.Types.ObjectId, ref: 'User' }] })
  members: User[];

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  createdBy: User;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Organization' })
  organizationId: Organization;
}

export const GroupSchema = SchemaFactory.createForClass(Group);
