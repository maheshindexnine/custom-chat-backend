import { Injectable, OnModuleInit } from "@nestjs/common";

@Injectable()
export class TurnServerService implements OnModuleInit {
  private turnServer: any;

  onModuleInit() {
    try {
      // Try to import node-turn dynamically
      const turn = require("node-turn");

      // Create and start a TURN server
      this.turnServer = new turn({
        // TURN server port
        authMech: "long-term",
        credentials: {
          webrtc: "turnserver",
        },
        realm: "chat-app",
        debugLevel: "ALL",
      });

      this.turnServer.start();
      console.log("TURN server started");
    } catch (error) {
      console.warn(
        "Could not start TURN server. You may need to install node-turn:"
      );
      console.warn("npm install node-turn");
      console.warn("Error details:", error.message);
    }
  }
}
