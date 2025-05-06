import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Schema as MongooseSchema, Types } from "mongoose";
import { User } from "./user.schema";
export type MessageDocument = Message & Document;

@Schema({ timestamps: true })
export class Message {
  _id: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "User", required: true })
  sender: User;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "User" })
  receiver: User;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "Group" })
  group: string;

  @Prop()
  content: string;

  @Prop({ default: false })
  read: boolean;

  @Prop({
    type: {
      filename: String,
      originalName: String,
      mimeType: String,
      size: Number,
    },
  })
  attachment: {
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
  };

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "Tenant" })
  tenant: Types.ObjectId;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ default: false })
  edited: boolean;

  @Prop({ default: false })
  isForwarded: boolean;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "Message" })
  replyTo: Message;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Add pre-hooks
// MessageSchema.pre("save", function (next) {
//   if (!this.deletedOn) {
//     this.deletedOn = null;
//   }
//   next();
// });
