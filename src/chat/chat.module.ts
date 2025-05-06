import { Module, forwardRef } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { UsersModule } from '../users/users.module';
import { MessagesModule } from '../messages/messages.module';
import { GroupsModule } from '../groups/groups.module';

@Module({
  imports: [
    UsersModule,
    forwardRef(() => MessagesModule),
    GroupsModule,
  ],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class ChatModule {}
