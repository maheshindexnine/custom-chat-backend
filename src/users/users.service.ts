import {
  Inject,
  Injectable,
  BadRequestException,
  NotFoundException,
  Scope,
  UnauthorizedException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { connect, Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { GroupsService } from '../groups/groups.service';
import { Message, MessageDocument } from '../schemas/message.schema';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { Group, GroupDocument } from '../schemas/group.schema';
import * as fs from 'fs/promises';
import * as sharp from 'sharp';
import * as path from 'path';
import { OrganizationsService } from '../organizations/organizations.service';
import { AuthJwtService } from '../auth/jwt.service';
import { ConnectUserDto } from './dto/connect-user-dto';
import { ConnectUserResponse } from './users.controller';
import { UpdateUserDto } from './dto/update-user.dto';

interface ListResponse {
  _id: string;
  name: string;
  type: 'user' | 'group';
  profileImage: string;
  lastSeen?: Date;
  isOnline?: boolean;
  totalMembers?: number;
  lastMessageAt: Date | null;
  lastMessage?: Message | null;
  createdBy?: User;
  unreadCount: number;
}
@Injectable()
export class UsersService {
  private readonly uploadDir: string;
  private UserModelInstance: Model<UserDocument>;
  private MessageModelInstance: Model<MessageDocument>;
  private GroupModelInstance: Model<GroupDocument>;

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    private configService: ConfigService,
    private organizationsService: OrganizationsService,
    private authJwtService: AuthJwtService,
  ) {
    this.uploadDir =
      this.configService.get<string>('UPLOAD_DIR') ||
      'uploads/profile-pictures';
    this.ensureUploadDir();
  }

  private async ensureUploadDir() {
    try {
      await fs.access(this.uploadDir);
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true });
    }
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    const createdUser = new this.userModel({
      ...createUserDto,
      organizationId: new mongoose.Types.ObjectId(createUserDto.organizationId),
    });
    return createdUser.save();
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    request: any,
  ): Promise<User | null> {
    return this.userModel
      .findByIdAndUpdate(id, updateUserDto, {
        new: true,
      })
      .exec();
  }

  async deleteUser(id: string): Promise<User | null> {
    return this.userModel
      .findByIdAndUpdate(
        id,
        { isDeleted: true },
        {
          new: true,
        },
      )
      .exec();
  }

  async findAll(request: any): Promise<User[]> {
    const page = parseInt(request.query.page) || 1;
    const limit = parseInt(request.query.limit) || 10;
    const skip = (page - 1) * limit;
    const organizationId = request.user?.organizationId;
    const userId = request.user?.userId;

    if (!organizationId) {
      throw new UnauthorizedException('Organization ID is required');
    }

    const users = await this.userModel.aggregate([
      {
        $match: {
          organizationId: new mongoose.Types.ObjectId(organizationId),
          _id: { $ne: new mongoose.Types.ObjectId(userId) },
          isDeleted: false,
        },
      },
      { $addFields: { type: 'user' } },
    ]);

    const groups = await this.groupModel.aggregate([
      {
        $match: {
          organizationId: new mongoose.Types.ObjectId(organizationId),
          isDeleted: false,
        },
      },
      { $addFields: { type: 'group' } },
      {
        $lookup: {
          from: 'users',
          localField: 'members',
          foreignField: '_id',
          as: 'members',
        },
      },
    ]);

    // Merge, sort, and paginate manually
    const combined = [...users, ...groups].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return combined.slice(skip, skip + limit);
  }

  async findAllByAdmin(request: any): Promise<User[]> {
    const page = parseInt(request.query.page) || 1;
    const limit = parseInt(request.query.limit) || 10;
    const skip = (page - 1) * limit;
    const organizationId = request.user?.organizationId;
    const userId = request.user?.userId;

    if (!organizationId) {
      throw new UnauthorizedException('Organization ID is required');
    }

    return this.userModel.aggregate([
      {
        $match: {
          organizationId: new mongoose.Types.ObjectId(organizationId),
          _id: { $ne: new mongoose.Types.ObjectId(userId) },
          isDeleted: false,
        },
      },
      {
        $limit: limit,
      },
      {
        $skip: skip,
      },
    ]);
  }

  async adminLogin(loginDto: ConnectUserDto): Promise<any> {
    const user = await this.userModel
      .findOne({
        email: loginDto.email,
        password: loginDto.password,
      })
      .exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const token = this.authJwtService.generateToken({
      userId: user._id.toString(),
      email: user.email,
      organizationId: user.organizationId.toString(),
      name: user.name,
    });

    return {
      name: user.name,
      token,
    };
  }

  async connect(connectUserDto: ConnectUserDto): Promise<ConnectUserResponse> {
    const user = await this.userModel
      .findOne({
        email: connectUserDto.email,
        password: connectUserDto.password,
      })
      .exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const token = this.authJwtService.generateToken({
      userId: user._id.toString(),
      email: user.email,
      organizationId: user.organizationId.toString(),
      name: user.name,
    });

    return {
      name: user.name,
      token,
    };
  }

  async findAllnew(
    page: string | number,
    limit: string | number,
    request: any,
  ): Promise<{ data: ListResponse[]; total: number }> {
    // Convert parameters to numbers
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    const skip = (pageNum - 1) * limitNum;

    // Run DB queries in parallel for performance
    const [users, groups, lastMessagesResult] = await Promise.all([
      this.UserModelInstance.find().sort({ lastSeen: -1 }).lean().exec(),
      this.GroupModelInstance.find().populate('members').lean().exec(),
      this.MessageModelInstance.aggregate([
        { $match: { isDeleted: false } },
        { $sort: { createdAt: -1 } },
        {
          $facet: {
            directMessages: [
              { $match: { group: null } },
              {
                $group: {
                  _id: {
                    $cond: [
                      { $eq: ['$sender', '$receiver'] },
                      null,
                      {
                        $map: {
                          input: ['$sender', '$receiver'],
                          as: 'user',
                          in: { $toString: '$$user' },
                        },
                      },
                    ],
                  },
                  lastMessage: { $first: '$$ROOT' },
                  lastMessageAt: { $first: '$createdAt' },
                },
              },
            ],
            groupMessages: [
              { $match: { group: { $ne: null } } },
              {
                $group: {
                  _id: { $toString: '$group' },
                  lastMessage: { $first: '$$ROOT' },
                  lastMessageAt: { $first: '$createdAt' },
                },
              },
            ],
          },
        },
      ]),
    ]);

    const [directMessages, groupMessages] = [
      lastMessagesResult[0]?.directMessages || [],
      lastMessagesResult[0]?.groupMessages || [],
    ];

    const userInteractionMap = new Map<string, Date>();
    const groupInteractionMap = new Map<string, Date>();
    const lastMessageMap = new Map<string, any>();

    // Process direct messages
    for (const msg of directMessages) {
      if (Array.isArray(msg._id)) {
        for (const userId of msg._id) {
          userInteractionMap.set(userId, msg.lastMessageAt);
          lastMessageMap.set(userId, msg.lastMessage);
        }
      }
    }

    // Process group messages
    for (const msg of groupMessages) {
      groupInteractionMap.set(msg._id, msg.lastMessageAt);
      lastMessageMap.set(msg._id, msg.lastMessage);
    }

    // Calculate unread counts for both users and groups
    const unreadCountMap = new Map<string, number>();

    // Get all unread messages
    const unreadMessages = await this.MessageModelInstance.find({ read: false })
      .lean()
      .exec();

    // Count unread messages for each user and group
    for (const msg of unreadMessages) {
      if (msg.group) {
        // Group message
        const groupId = msg.group.toString();
        unreadCountMap.set(groupId, (unreadCountMap.get(groupId) || 0) + 1);
      } else if (msg.sender && msg.receiver) {
        // Direct message
        const senderId = msg.sender.toString();
        const receiverId = msg.receiver.toString();

        // For direct messages, count unread messages for the receiver
        if (senderId !== receiverId) {
          // Skip self-messages
          unreadCountMap.set(
            receiverId,
            (unreadCountMap.get(receiverId) || 0) + 1,
          );
        }
      }
    }

    const backgroundColors = ['#8b959d'];

    const usersList: ListResponse[] = users.map((user) => {
      const userId = user._id.toString();
      return {
        _id: user._id,
        name: user.name,
        type: 'user',
        email: user.email,
        mobile: user.mobile,
        profileImage: user.profileImage
          ? `${process.env.WEBSITE_URL}/${user.profileImage}`
          : '',
        lastSeen: user.lastSeen,
        isOnline: user.isOnline,
        lastMessageAt: userInteractionMap.get(userId) || new Date(0),
        lastMessage: lastMessageMap.get(userId) || null,
        unreadCount: unreadCountMap.get(userId) || 0,
      };
    });

    const groupsList: ListResponse[] = groups.map((group) => {
      const groupId = group._id.toString();
      return {
        _id: group._id,
        name: group.name,
        type: 'group',
        profileImage: group.profileImage
          ? `${process.env.WEBSITE_URL}/${group.profileImage}`
          : '',
        totalMembers: group.members?.length || 0,
        members: group.members,
        lastMessageAt: groupInteractionMap.get(groupId) || new Date(0),
        lastMessage: lastMessageMap.get(groupId) || null,
        createdBy: group.createdBy,
        unreadCount: unreadCountMap.get(groupId) || 0,
      };
    });

    const combinedList = [...usersList, ...groupsList];

    // Sort: first by latest message, then prioritize group over user if close timestamps
    combinedList.sort((a: any, b: any) => {
      const diff = b?.lastMessageAt.getTime() - a.lastMessageAt.getTime();

      // If timestamps are close (< 3 seconds), prioritize groups
      if (Math.abs(diff) < 3000) {
        if (a.type === 'group' && b.type === 'user') return -1;
        if (a.type === 'user' && b.type === 'group') return 1;
      }

      return diff;
    });

    // Apply pagination
    const paginatedItems = combinedList.slice(skip, skip + limitNum);

    return {
      data: paginatedItems,
      total: combinedList.length,
    };
  }

  async findOne(id: string, request: any): Promise<User | null> {
    return this.UserModelInstance.findById(id).exec();
  }

  async findByUserId(request: any): Promise<any> {
    const user = request?.user;

    const userId = user?.user?.id;
    const vId = user?.user?.v_id;

    if (!userId || !vId) {
      throw new Error('User or Vendor ID not found');
    }

    const allUserData = await this.UserModelInstance.findOne({
      userId: userId,
    }).exec();

    if (!allUserData) {
      return {
        status: false,
        message: 'User not found in database',
      };
    }

    return allUserData;
  }

  async findByname(name: string, request: any): Promise<User | null> {
    return this.userModel.findOne({ name }).exec();
  }

  async updateOnlineStatus(
    id: string,
    isOnline: boolean,
  ): Promise<User | null> {
    const lastSeen = isOnline ? null : new Date();
    return this.userModel
      .findByIdAndUpdate(id, { isOnline, lastSeen }, { new: true })
      .exec();
  }

  async updateProfilePicture(
    userId: string,
    file: Express.Multer.File,
    uploadType: string,
    request: any,
  ): Promise<User | Group> {
    let entity;

    // Find entity based on uploadType
    if (uploadType === 'group') {
      entity = await this.GroupModelInstance.findById(userId);
    } else {
      entity = await this.UserModelInstance.findById(userId);
    }

    if (!entity) {
      throw new NotFoundException(
        `${uploadType === 'group' ? 'Group' : 'User'} not found`,
      );
    }

    try {
      // Generate unique filename
      const filename = `${userId}-${Date.now()}${path.extname(file.originalname)}`;
      const filepath = path.join(this.uploadDir, filename);

      // Process and optimize the image
      await sharp(file.buffer)
        .resize(500, 500, {
          fit: 'cover',
          position: 'center',
        })
        .jpeg({ quality: 80 })
        .toFile(filepath);

      // Delete old profile picture if it exists
      if (entity && entity.profileImage) {
        const oldFilePath = path.join(process.cwd(), entity.profileImage);
        try {
          await fs.unlink(oldFilePath);
        } catch (error) {
          console.error('Error deleting old profile picture:', error);
        }
      }

      // Update entity profile with new image path
      const relativeFilePath = path
        .join('uploads/profile-pictures', filename)
        .replace(/\\/g, '/');

      let updatedEntity;
      if (uploadType === 'group') {
        updatedEntity = await this.GroupModelInstance.findByIdAndUpdate(
          userId,
          {
            profileImage: relativeFilePath,
            updatedAt: new Date(),
          },
          { new: true },
        );
      } else {
        updatedEntity = await this.UserModelInstance.findByIdAndUpdate(
          userId,
          {
            profileImage: relativeFilePath,
            updatedAt: new Date(),
          },
          { new: true },
        );
      }

      if (!updatedEntity) {
        throw new NotFoundException(
          `${uploadType === 'group' ? 'Group' : 'User'} not found after update`,
        );
      }

      return updatedEntity;
    } catch (error) {
      console.error('Error updating profile picture:', error);
      throw new BadRequestException(
        `Failed to update profile picture: ${error.message}`,
      );
    }
  }
}
