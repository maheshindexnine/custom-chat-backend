import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Req,
  UseGuards,
} from '@nestjs/common';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { Group } from '../schemas/group.schema';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('api/v1/groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Body() createGroupDto: CreateGroupDto,
    @Req() req: any,
  ): Promise<Group> {
    return this.groupsService.create(createGroupDto, req);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Req() req: any): Promise<Group[]> {
    return this.groupsService.findAll(req);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @Body() updateGroupDto: UpdateGroupDto,
    @Req() req: any,
  ): Promise<Group | null> {
    return this.groupsService.update(id, updateGroupDto, req);
  }

  @Post(':id/members/:userId')
  @UseGuards(JwtAuthGuard)
  addMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ): Promise<Group | null> {
    return this.groupsService.addMember(id, userId, req);
  }

  @Delete(':id/members/:userId')
  @UseGuards(JwtAuthGuard)
  removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ): Promise<Group | null> {
    return this.groupsService.removeMember(id, userId, req);
  }
}
