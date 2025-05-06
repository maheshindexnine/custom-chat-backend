import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Req,
} from '@nestjs/common';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { Group } from '../schemas/group.schema';

@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  create(
    @Body() createGroupDto: CreateGroupDto,
    @Req() req: any,
  ): Promise<Group> {
    return this.groupsService.create(createGroupDto, req);
  }

  @Get()
  findAll(@Req() req: any): Promise<Group[]> {
    return this.groupsService.findAll(req);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any): Promise<Group | null> {
    return this.groupsService.findOne(id, req);
  }

  @Get('user/:userId')
  findUserGroups(
    @Param('userId') userId: string,
    @Req() req: any,
  ): Promise<Group[]> {
    return this.groupsService.findUserGroups(userId, req);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateGroupDto: UpdateGroupDto,
    @Req() req: any,
  ): Promise<Group | null> {
    return this.groupsService.update(id, updateGroupDto, req);
  }

  @Post(':id/members/:userId')
  addMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ): Promise<Group | null> {
    return this.groupsService.addMember(id, userId, req);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ): Promise<Group | null> {
    return this.groupsService.removeMember(id, userId, req);
  }
}
