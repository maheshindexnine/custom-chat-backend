import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { Schema as MongooseSchema } from "mongoose";

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  _id: string;

  @Prop({ required: false })
  name: string;

  @Prop()
  profileImage?: string;

  @Prop()
  isOnline: boolean;

  @Prop()
  lastSeen: Date;

  @Prop({ required: false })
  email: string;

  @Prop({ required: false })
  mobile: string;

  @Prop({ required: false })
  roles: string[];

  @Prop({ required: false })
  status: string;

  @Prop({ required: false })
  userId: number;

  @Prop({ required: false })
  vId: number;

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
