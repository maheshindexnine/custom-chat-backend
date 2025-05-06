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
    console.log(`Client connected: ${client.id}`);
    const userId = client.handshake.query.userId as string;
    console.log(userId);

    const tenantId = client.handshake.query['x-tenant-id'] as string;
    console.log('tenantId:', tenantId);

    // Store connection in socket data
    const request = {
      tenantId: tenantId,
    };
    client.data.tenantId = tenantId;

    if (!userId) {
      // console.log("Client connected without userId, disconnecting");
      client.disconnect();
      return;
    }

    // console.log(`Client connected: ${client.id}, userId: ${userId}`);

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
    await this.usersService.updateOnlineStatus(userId, true, request);

    // Broadcast user connected events
    this.server.emit('userConnected', userId);
    this.server.emit('userStatusChanged', { userId, isOnline: true });

    // Send list of online users to the newly connected client
    client.emit('onlineUsers', Array.from(this.onlineUsers));
  }

  async handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    const userId =
      this.socketUserMap.get(client.id) || this.socketUserMap2[client.id];
    const tenantId = client.handshake.query['x-tenant-id'] as string;

    // Store connection in socket data
    const request = {
      tenantId: tenantId,
    };
    client.data.tenantId = tenantId;

    // Also store in TenantService for potential use in other contexts
    // this.tenantService.setCurrentTenantConnection(tenantConnection);

    if (userId) {
      // console.log(`Client disconnected: ${client.id}, userId: ${userId}`);

      // Remove from all mappings
      this.userSocketMap.delete(userId);
      this.socketUserMap.delete(client.id);
      delete this.userSocketMap2[userId];
      delete this.socketUserMap2[client.id];

      // Remove from online users
      this.onlineUsers.delete(userId);

      try {
        // Update online status in database
        await this.usersService.updateOnlineStatus(userId, false, request);
      } catch (error) {
        console.error('Error updating offline status:', error);
      }

      // Broadcast user disconnected events
      this.server.emit('userDisconnected', userId);
      this.server.emit('userStatusChanged', { userId, isOnline: false });

      // Clean up tenant connection for this socket
      // if (this.tenantService) {
      //   // this.tenantService.removeTenantConnectionForSocket(client.id);
      // } else {
      //   console.error("TenantService is not available");
      // }
    }
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(client: Socket, payload: any) {
    try {
      console.log('Received message111:', payload);
      // console.log("console20:", payload);
      let populatedMessage;

      // Create a request-like object with the tenant connection
      const request = {
        tenantConnection: client.data.tenantConnection,
        tenantId: client.data.tenantId,
      };

      // Check if the message already has an ID (was already created during file upload)
      if (payload._id) {
        // console.log("Message already exists with ID:", payload._id);

        // Get the populated message
        let messages;
        if (payload.group) {
          messages = await this.messagesService.findGroupMessages(
            payload.group,
            1,
            0,
            request,
          );
        } else if (payload.receiver) {
          messages = await this.messagesService.findDirectMessages(
            payload.sender,
            payload.receiver,
            1,
            0,
            request,
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
          request,
        );

        console.log('Message created:', message);

        // Get the populated message
        let messages;
        if (payload.group) {
          messages = await this.messagesService.findGroupMessages(
            payload.group,
            1,
            0,
            request,
          );
        } else if (payload.receiver) {
          messages = await this.messagesService.findDirectMessages(
            payload.sender,
            payload.receiver,
            1,
            0,
            request,
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
        console.log('console8:', populatedMessage);
      } else if (payload.receiver) {
        // For direct messages, emit to the receiver
        const receiverSocketId = this.userSocketMap.get(payload.receiver);
        if (receiverSocketId) {
          this.server.to(receiverSocketId).emit('newMessage', populatedMessage);
          console.log('console9:', populatedMessage);
        }

        // Only emit to the sender if they're not the same as the receiver
        // This prevents duplicate messages when sending to yourself
        if (client.id !== receiverSocketId) {
          client.emit('newMessage', populatedMessage);
          // console.log("console10:", populatedMessage);
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
    const { name, members, createdBy } = payload;
    const request = {
      tenantConnection: client.data.tenantConnection,
      tenantId: client.data.tenantId,
    };

    const group = await this.groupsService.create(
      {
        name,
        members,
        createdBy,
      },
      request,
    );

    // Get the populated group - use _id instead of id
    const populatedGroup = await this.groupsService.findOne(group._id, request);

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
    // console.log("Marking message as read:", messageId);

    try {
      // Check if the messageId is a valid MongoDB ObjectId
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(messageId);

      if (!isValidObjectId) {
        console.warn(
          `Invalid message ID format: ${messageId}. Must be a valid MongoDB ObjectId.`,
        );
        return;
      }

      const request = {
        tenantConnection: client.data.tenantConnection,
        tenantId: client.data.tenantId,
      };

      // if (client.data.tenantConnection) {
      //   this.tenantService.setCurrentTenantConnection(
      //     client.data.tenantConnection
      //   );
      // }

      // Mark the message as read
      const message = await this.messagesService.markAsRead(messageId, request);

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
    // console.log("Call offer received:", payload);
    const { to, from, offer, callType, isGroup } = payload;

    console.log('Call offer received:', {
      from: from,
      to: to,
      // offer: offer,
      callType: callType,
      isGroup: isGroup,
    });

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
    console.log('Call answer received:', {
      from: from,
      to: to,
    });
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
    console.log('ICE candidate received New:', payload);
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
    console.log('Call ended:', payload);
    const { to, reason, isDecline, isGroup } = payload;

    // If this is a decline in a group call, only notify the original caller
    if (isDecline && isGroup) {
      const userId = this.socketUserMap.get(client.id);
      console.log(`User ${userId} declined the group call`);

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

    console.log('Call rejected:', {
      to: to,
      reason: reason,
      isGroup: isGroup,
    });

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
    console.log('Screen share event received:', {
      from: from,
      to: to,
      isGroup: isGroup,
    });

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
    console.log(`Message ${messageId} deleted by user ${userId}`);

    try {
      const request = {
        tenantConnection: client.data.tenantConnection,
        tenantId: client.data.tenantId,
      };

      // Get the message to determine who should be notified
      const message = await this.messagesService.findOne(messageId, request);

      if (message) {
        if (message.group) {
          console.log('messageDeleted-group', {
            groupId: message.group,
            messageId: messageId,
            userId: userId,
          });
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
          console.log('messageDeleted', {
            senderSocketId: senderSocketId,
            receiverSocketId: receiverSocketId,
            messageId: messageId,
            userId: userId,
          });
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
    console.log(`Message ${messageId} edited by user ${userId}`);

    try {
      const request = {
        tenantConnection: client.data.tenantConnection,
        tenantId: client.data.tenantId,
      };

      // Get the message to determine who should be notified
      const message = await this.messagesService.findOne(messageId, request);

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
