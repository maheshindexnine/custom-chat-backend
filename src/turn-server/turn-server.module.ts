import { Module } from "@nestjs/common";
import { TurnServerService } from "./turn-server.service";

@Module({
  providers: [TurnServerService],
})
export class TurnServerModule {}
