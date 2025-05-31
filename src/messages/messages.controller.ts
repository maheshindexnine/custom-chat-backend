import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  Res,
  Inject,
  forwardRef,
  Delete,
  Put,
  Req,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { Message } from '../schemas/message.schema';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ChatGateway } from '../chat/chat.gateway';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { UpdateMessageDto } from './dto/update-message.dto';

@Controller('api/v1/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  create(
    @Body() createMessageDto: CreateMessageDto,
    @Req() req: any,
  ): Promise<Message> {
    return this.messagesService.create(createMessageDto, req);
  }

  @Get('direct/:userId1/:userId2')
  findDirectMessages(
    @Param('userId1') userId1: string,
    @Param('userId2') userId2: string,
    @Req() req: any,
    @Query('limit') limit?: number,
    @Query('skip') skip?: number,
  ): Promise<Message[]> {
    return this.messagesService.findDirectMessages(
      userId1,
      userId2,
      limit,
      skip,
      req,
    );
  }

  @Get('group/:groupId')
  findGroupMessages(
    @Param('groupId') groupId: string,
    @Req() req: any,
    @Query('limit') limit?: number,
    @Query('skip') skip?: number,
  ): Promise<Message[]> {
    return this.messagesService.findGroupMessages(groupId, limit, skip, req);
  }

  @Post(':id/read')
  markAsRead(@Param('id') id: string, @Req() req: any): Promise<Message | null> {
    return this.messagesService.markAsRead(id, req);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
    }),
  )
  async uploadFile(
    @UploadedFile() file,
    @Body()
    body: {
      sender: string;
      receiver?: string;
      group?: string;
      content?: string;
      replyTo?: string;
    },
    @Req() req: any,
  ) {
    const attachment = {
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
    let messageData: {
      sender: string;
      receiver?: string;
      group?: string;
      content: string;
      attachment: any;
      replyTo?: string;
    } = {
      sender: body.sender,
      receiver: body.receiver,
      group: body.group,
      content: body.content || '',
      attachment,
    };
    if (body.replyTo) {
      messageData.replyTo = body.replyTo;
    }
    const message = await this.messagesService.create(messageData, req);

    return message;
  }

  @Get('/uploads/:filename')
  getFile(@Param('filename') filename: string, @Res() res: Response) {
    const file = path.join(process.cwd(), 'uploads', filename);
    return res.sendFile(file);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: any) {
    return this.messagesService.softDelete(id, req);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateMessageDto: UpdateMessageDto,
    @Req() req: any,
  ): Promise<Message | null> {
    return this.messagesService.update(id, updateMessageDto, req);
  }
}
