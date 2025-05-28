import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  FileTypeValidator,
  ParseFilePipeBuilder,
  UploadedFile,
  UseInterceptors,
  MaxFileSizeValidator,
  BadRequestException,
  Req,
  UseGuards,
  Patch,
  Delete,
  Request,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from '../schemas/user.schema';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConnectUserDto } from './dto/connect-user-dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

export class ConnectUserResponse {
  name: string;
  token: string;
}

interface UserResponse extends Omit<User, 'token'> {
  token: string;
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // get the orgId from jwt token normal user get Id and for admin get orgId form org module - next task
  @Post()
  async create(
    @Body() createUserDto: CreateUserDto,
    @Req() request: any,
  ): Promise<User> {
    const checkUser = await this.usersService.findByname(
      createUserDto.name,
      request,
    );
    if (checkUser) {
      return checkUser;
    }

    const user = await this.usersService.create(createUserDto);
    return user;
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@Req() req: Request): Promise<User[]> {
    return await this.usersService.findAll(req);
  }

  @Get('get-user')
  async getById(@Req() req: Request): Promise<any> {
    return await this.usersService.findByUserId(req);
  }

  @Get('v1')
  async findAllnew(
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Req() req: any,
  ): Promise<any> {
    const users = await this.usersService.findAllnew(page, limit, req);
    return {
      success: true,
      data: users?.data,
      total: users?.total,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Req() req: any,
  ): Promise<User | null> {
    return await this.usersService.findOne(id, req);
  }

  @Post('connect')
  async connect(
    @Body() connectUserDto: ConnectUserDto,
  ): Promise<ConnectUserResponse> {
    return await this.usersService.connect(connectUserDto);
  }

  @Post(':id/:type/profile-picture')
  @UseInterceptors(FileInterceptor('file'))
  async updateProfilePicture(
    @Param('id') userId: string,
    @Param('type') uploadType: string,
    @Req() req: Request,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addValidator(
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
        )
        .addValidator(new FileTypeValidator({ fileType: /(jpg|jpeg|png)$/ }))
        .build({
          errorHttpStatusCode: 400,
        }),
    )
    file: Express.Multer.File,
  ) {
    try {
      const updatedUser = await this.usersService.updateProfilePicture(
        userId,
        file,
        uploadType,
        req,
      );
      return {
        success: true,
        message: 'Profile picture updated successfully',
        data: {
          profileImage: `${process.env.WEBSITE_URL}/${updatedUser.profileImage}`,
        },
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateUserDto: Partial<CreateUserDto>,
    @Request() req,
  ) {
    return this.usersService.update(id, updateUserDto, req);
  }

  // @UseGuards(JwtAuthGuard)
  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.usersService.remove(id);
  // }
}
