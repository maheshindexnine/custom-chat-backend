import { Injectable, Inject, Scope, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Group, GroupDocument } from '../schemas/group.schema';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';

@Injectable()
export class GroupsService {
  private GroupModelInstance: Model<GroupDocument>;

  constructor(
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
  ) {}

  async create(createGroupDto: CreateGroupDto, request: any): Promise<Group> {
    const createdGroup = new this.groupModel(createGroupDto);
    return createdGroup.save();
  }

  async findAll(request: any): Promise<Group[]> {
    return this.groupModel.find().populate('members').exec();
  }

  async findOne(id: string, request: any): Promise<Group | null> {
    return this.groupModel.findById(id).populate('members').exec();
  }

  async findUserGroups(userId: string, request: any): Promise<Group[]> {
    return this.groupModel.find({ members: userId }).populate('members').exec();
  }

  async update(
    id: string,
    updateGroupDto: UpdateGroupDto,
    request: any,
  ): Promise<Group | null> {
    return this.groupModel
      .findByIdAndUpdate(id, updateGroupDto, {
        new: true,
      })
      .exec();
  }

  async addMember(
    groupId: string,
    userId: string,
    request: any,
  ): Promise<Group | null> {
    return this.groupModel
      .findByIdAndUpdate(
        groupId,
        { $addToSet: { members: userId } },
        { new: true },
      )
      .exec();
  }

  async removeMember(
    groupId: string,
    userId: string,
    request: any,
  ): Promise<Group | null> {
    return this.groupModel
      .findByIdAndUpdate(groupId, { $pull: { members: userId } }, { new: true })
      .exec();
  }
}
