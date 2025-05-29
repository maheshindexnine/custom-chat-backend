import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GroupsService } from 'src/groups/groups.service';
import { MessagesService } from 'src/messages/messages.service';
import { UsersService } from 'src/users/users.service';

@WebSocketGateway({ cors: true })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Initialize all maps explicitly
  private userSocketMap = new Map<string, string>();
  private socketUserMap = new Map<string, string>();
  private typingUsers = new Map<string, { userId: string; name: string }>();
  private userSocketMap2 = {};
  private socketUserMap2 = {};
  private onlineUsers = new Set<string>();

  constructor(
    private readonly usersService: UsersService,
    private readonly messagesService: MessagesService,
    private readonly groupsService: GroupsService,
  ) {
    // Make sure maps are initialized
    this.userSocketMap = new Map<string, string>();
    this.socketUserMap = new Map<string, string>();
    this.typingUsers = new Map<string, { userId: string; name: string }>();
    this.userSocketMap2 = {};
    this.socketUserMap2 = {};
    this.onlineUsers = new Set<string>();
  }

  async handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;

    if (!userId) {
      client.disconnect();
      return;
    }

    // Store the mapping in both data structures
    this.userSocketMap.set(userId, client.id);
    this.socketUserMap.set(client.id, userId);
    this.userSocketMap2[userId] = client.id;
    this.socketUserMap2[client.id] = userId;

    // Add to online users
    this.onlineUsers.add(userId);

    // Join user's room for direct messages
    client.join(`user:${userId}`);

    // Update online status in database
    await this.usersService.updateOnlineStatus(userId, true);

    // Broadcast user connected events
    this.server.emit('userConnected', userId);
    this.server.emit('userStatusChanged', { userId, isOnline: true });

    // Send list of online users to the newly connected client
    client.emit('onlineUsers', Array.from(this.onlineUsers));
  }

  async handleDisconnect(client: Socket) {
    const userId =
      this.socketUserMap.get(client.id) || this.socketUserMap2[client.id];

    if (userId) {
      // Remove from all mappings
      this.userSocketMap.delete(userId);
      this.socketUserMap.delete(client.id);
      delete this.userSocketMap2[userId];
      delete this.socketUserMap2[client.id];

      // Remove from online users
      this.onlineUsers.delete(userId);

      try {
        // Update online status in database
        await this.usersService.updateOnlineStatus(userId, false);
      } catch (error) {
        console.error('Error updating offline status:', error);
      }

      // Broadcast user disconnected events
      this.server.emit('userDisconnected', userId);
      this.server.emit('userStatusChanged', { userId, isOnline: false });
    }
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(client: Socket, payload: any) {
    try {
      let populatedMessage;

      // Check if the message already has an ID (was already created during file upload)
      if (payload._id) {
        // Get the populated message
        let messages;
        if (payload.group) {
          messages = await this.messagesService.findGroupMessages(
            payload.group,
            1,
            0,
            {},
          );
        } else if (payload.receiver) {
          messages = await this.messagesService.findDirectMessages(
            payload.sender,
            payload.receiver,
            1,
            0,
            {},
          );
        }
        populatedMessage = messages[0];
      } else {
        // Create the message if it doesn't exist yet
        const message = await this.messagesService.create(
          {
            sender: payload.sender,
            receiver: payload.receiver,
            group: payload.group,
            content: payload.content,
            attachment: payload.attachment,
            isForwarded: payload.isForwarded ?? false,
            replyTo: payload.replyTo ?? null,
          },
          {},
        );

        // Get the populated message
        let messages;
        if (payload.group) {
          messages = await this.messagesService.findGroupMessages(
            payload.group,
            1,
            0,
            {},
          );
        } else if (payload.receiver) {
          messages = await this.messagesService.findDirectMessages(
            payload.sender,
            payload.receiver,
            1,
            0,
            {},
          );
        }
        populatedMessage = messages[0];
      }

      // Emit the message only once
      if (payload.group) {
        // For group messages, emit to the group room only
        this.server
          .to(`group:${payload.group}`)
          .emit('newMessage', populatedMessage);
      } else if (payload.receiver) {
        // For direct messages, emit to the receiver
        const receiverSocketId = this.userSocketMap.get(payload.receiver);
        if (receiverSocketId) {
          this.server.to(receiverSocketId).emit('newMessage', populatedMessage);
        }

        // Only emit to the sender if they're not the same as the receiver
        // This prevents duplicate messages when sending to yourself
        if (client.id !== receiverSocketId) {
          client.emit('newMessage', populatedMessage);
        }
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }

  @SubscribeMessage('joinGroup')
  handleJoinGroup(client: Socket, groupId: string) {
    client.join(`group:${groupId}`);
  }

  @SubscribeMessage('leaveGroup')
  handleLeaveGroup(client: Socket, groupId: string) {
    client.leave(`group:${groupId}`);
  }

  @SubscribeMessage('createGroup')
  async handleCreateGroup(client: Socket, payload: any) {
    const { name, description, members, createdBy, organizationId } = payload;

    const group = await this.groupsService.create(
      {
        name,
        description,
        members,
        createdBy,
        organizationId,
      },
      {},
    );

    // Get the populated group - use _id instead of id
    const populatedGroup = await this.groupsService.findOne(group._id, {});

    // Notify all members about the new group
    members.forEach((memberId: string) => {
      const memberSocketId = this.userSocketMap.get(memberId);
      if (memberSocketId) {
        this.server.to(memberSocketId).emit('newGroup', populatedGroup);
      }
    });
  }

  @SubscribeMessage('typing')
  handleTyping(client: Socket, payload: any) {
    const { userId, name, receiverId, groupId } = payload;

    if (groupId) {
      // For group chats, broadcast to all members in the group
      this.server
        .to(`group:${groupId}`)
        .emit('userTyping', { userId, name, groupId });

      // Clear typing status after 3 seconds
      setTimeout(() => {
        this.server
          .to(`group:${groupId}`)
          .emit('userStoppedTyping', { userId, groupId });
      }, 3000);
    } else if (receiverId) {
      // For direct messages, send to the specific recipient
      const receiverSocketId = this.userSocketMap.get(receiverId);
      if (receiverSocketId) {
        this.server.to(receiverSocketId).emit('userTyping', { userId, name });

        // Clear typing status after 3 seconds
        setTimeout(() => {
          this.server
            .to(receiverSocketId)
            .emit('userStoppedTyping', { userId });
        }, 3000);
      }
    }
  }

  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() messageId: string,
  ) {
    try {
      // Check if the messageId is a valid MongoDB ObjectId
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(messageId);

      if (!isValidObjectId) {
        console.warn(
          `Invalid message ID format: ${messageId}. Must be a valid MongoDB ObjectId.`,
        );
        return;
      }

      // Mark the message as read
      const message = await this.messagesService.markAsRead(messageId, {});

      if (message) {
        // Broadcast to all connected clients that the message has been read
        this.server.emit('messageRead', messageId);
      } else {
        console.warn(`Message not found with ID: ${messageId}`);
      }
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  }

  @SubscribeMessage('callOffer')
  async handleCallOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ) {
    const { to, from, offer, callType, isGroup } = payload;

    if (isGroup) {
      // For group calls, broadcast to all members except the sender
      client.to(`group:${to}`).emit('callOffer', {
        offer,
        from,
        to,
        callType,
      });
    } else {
      // For direct calls, send to the specific recipient
      const recipientSocketId = this.getUserSocketId(to);
      if (recipientSocketId) {
        this.server.to(recipientSocketId).emit('callOffer', {
          offer,
          from,
          to,
          callType,
        });
      }
    }
  }

  @SubscribeMessage('callAnswer')
  async handleCallAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ) {
    const { to, from, answer } = payload;
    const recipientSocketId = this.getUserSocketId(to);
    if (recipientSocketId) {
      this.server.to(recipientSocketId).emit('callAnswer', {
        answer,
        from,
      });
    }
  }

  @SubscribeMessage('iceCandidateNew')
  async handleIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ) {
    const { to, candidate } = payload;

    const recipientSocketId = this.getUserSocketId(to);
    if (recipientSocketId) {
      this.server.to(recipientSocketId).emit('iceCandidate', {
        candidate,
      });
    }
  }

  @SubscribeMessage('callEnded')
  async handleCallEnded(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ) {
    const { to, reason, isDecline, isGroup } = payload;

    // If this is a decline in a group call, only notify the original caller
    if (isDecline && isGroup) {
      const userId = this.socketUserMap.get(client.id);
      // Only send the decline notification to the caller (to)
      const recipientSocketId = this.getUserSocketId(to);
      if (recipientSocketId) {
        this.server.to(recipientSocketId).emit('callEnded', {
          reason,
          from: userId,
          isDecline: true,
          isGroup: true,
        });
      }
    } else if (to.includes('group:')) {
      // For group calls - full termination
      const groupId = to.replace('group:', '');
      client.to(`group:${groupId}`).emit('callEnded', {
        reason,
      });
    } else {
      // For direct calls
      const recipientSocketId = this.getUserSocketId(to);
      if (recipientSocketId) {
        this.server.to(recipientSocketId).emit('callEnded', {
          reason,
        });
      }
    }
  }

  @SubscribeMessage('callRejected')
  async handleCallRejected(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ) {
    const { to, reason, isGroup } = payload;

    // For group calls, only notify the caller but with a special event
    if (isGroup) {
      const recipientSocketId = this.getUserSocketId(to);
      if (recipientSocketId) {
        this.server.to(recipientSocketId).emit('callDeclined', {
          reason,
          userId: this.socketUserMap.get(client.id),
        });
      }
    } else {
      // For direct calls, notify the caller to end the call
      const recipientSocketId = this.getUserSocketId(to);
      if (recipientSocketId) {
        this.server.to(recipientSocketId).emit('callRejected', {
          reason,
        });
      }
    }
  }

  @SubscribeMessage('screenShare')
  async handleScreenShare(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ) {
    const { to, from, stream, isGroup } = payload;

    if (isGroup) {
      // For group calls
      const groupId = to.replace('group:', '');
      client.to(`group:${groupId}`).emit('screenShare', {
        from,
        stream,
      });
    } else {
      // For direct calls
      const recipientSocketId = this.getUserSocketId(to);
      if (recipientSocketId) {
        this.server.to(recipientSocketId).emit('screenShare', {
          from,
          stream,
        });
      }
    }
  }

  @SubscribeMessage('messageDeleted')
  async handleMessageDeleted(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ) {
    const { messageId, userId } = payload;

    try {
      // Get the message to determine who should be notified
      const message = await this.messagesService.findOne(messageId, {});

      if (message) {
        if (message.group) {
          // For group messages, notify all members
          this.server.to(`group:${message.group}`).emit('messageDeleted', {
            messageId,
            userId,
          });
        } else {
          // For direct messages, notify both sender and receiver
          const senderSocketId = this.getUserSocketId(
            message.sender.toString(),
          );
          const receiverSocketId = this.getUserSocketId(
            message.receiver.toString(),
          );
          if (senderSocketId) {
            this.server.to(senderSocketId).emit('messageDeleted', {
              messageId,
              userId,
            });
          }

          if (receiverSocketId) {
            this.server.to(receiverSocketId).emit('messageDeleted', {
              messageId,
              userId,
            });
          }
        }
      }
    } catch (error) {
      console.error('Error handling message deletion:', error);
    }
  }

  @SubscribeMessage('messageEdited')
  async handleMessageEdited(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ) {
    const { messageId, content, userId } = payload;

    try {
      // Get the message to determine who should be notified
      const message = await this.messagesService.findOne(messageId, {});

      if (message) {
        if (message.group) {
          // For group messages, notify all members
          this.server.to(`group:${message.group}`).emit('messageEdited', {
            messageId,
            content,
            userId,
          });
        } else {
          // For direct messages, notify both sender and receiver
          const senderSocketId = this.getUserSocketId(
            message.sender.toString(),
          );
          const receiverSocketId = this.getUserSocketId(
            message.receiver.toString(),
          );

          if (senderSocketId) {
            this.server.to(senderSocketId).emit('messageEdited', {
              messageId,
              content,
              userId,
            });
          }

          if (receiverSocketId) {
            this.server.to(receiverSocketId).emit('messageEdited', {
              messageId,
              content,
              userId,
            });
          }
        }
      }
    } catch (error) {
      console.error('Error handling message editing:', error);
    }
  }

  // Add this method to expose the userSocketMap
  getUserSocketId(userId: string): string | undefined {
    return this.userSocketMap.get(userId);
  }
}
