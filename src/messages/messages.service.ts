import {
  Injectable,
  NotFoundException,
  Inject,
  Scope,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message, MessageDocument } from '../schemas/message.schema';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';

@Injectable()
export class MessagesService {
  private MessageModelInstance: Model<MessageDocument>;

  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
  ) {}

  async create(
    createMessageDto: CreateMessageDto,
    request: any,
  ): Promise<Message> {
    const createdMessage = new this.messageModel(createMessageDto);
    const savedMessage = await createdMessage.save();

    return savedMessage;
  }

  async findDirectMessages(
    userId1: string,
    userId2: string,
    limit = 20,
    skip = 0,
    request: any,
  ): Promise<Message[]> {
    return this.messageModel
      .find({
        $or: [
          { sender: userId1, receiver: userId2 },
          { sender: userId2, receiver: userId1 },
        ],
        group: null,
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('sender')
      .exec();
  }

  async findGroupMessages(
    groupId: string,
    limit = 20,
    skip = 0,
    request: any,
  ): Promise<Message[]> {
    return this.messageModel
      .find({ group: groupId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('sender')
      .exec();
  }

  async markAsRead(messageId: string, request: any): Promise<Message | null> {
    return this.messageModel
      .findByIdAndUpdate(messageId, { read: true }, { new: true })
      .exec();
  }

  async softDelete(id: string, request: any) {
    try {
      // Find the message first
      const message = await this.messageModel.findById(id);

      if (!message) {
        throw new NotFoundException(`Message with ID ${id} not found`);
      }

      // Update the message to mark it as deleted
      const updatedMessage = await this.messageModel.findByIdAndUpdate(
        id,
        { isDeleted: true },
        { new: true },
      );

      return updatedMessage;
    } catch (error) {
      console.error('Error soft deleting message:', error);
      throw error;
    }
  }

  async findOne(id: string, request: any): Promise<Message | null> {
    return this.messageModel.findById(id).exec();
  }

  async update(
    id: string,
    updateMessageDto: UpdateMessageDto,
    request: any,
  ): Promise<Message | null> {
    // const data = {
    //   ...updateMessageDto,
    //   isEdited: true,
    // };
    const updatedMessage = await this.messageModel
      .findByIdAndUpdate(id, updateMessageDto, { new: true })
      .populate('sender')
      .populate('receiver')
      .exec();

    return updatedMessage;
  }
}
