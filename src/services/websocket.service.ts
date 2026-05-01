import { Server, Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createServer } from "http";
import jwt from "jsonwebtoken";
import { logger } from "../config/logger";
import getRedis from "../config/redis";
import getEnv from "../config/env";

let io: Server;

export function initWebSocket(
  httpServer: ReturnType<typeof createServer>,
): Server {
  const env = getEnv();
  const redis = getRedis();

  const corsOptions = {
    origin: env.CORS_ORIGINS.split(",").map((o) => o.trim()),
    credentials: true,
  };

  io = new Server(httpServer, {
    cors: corsOptions,
    transports: ["websocket", "polling"],
  });

  const pubClient = redis.duplicate();
  const subClient = redis.duplicate();
  io.adapter(createAdapter(pubClient, subClient));

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    if (!token) {
      return next(new Error("UNAUTHORIZED"));
    }
    try {
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as {
        userId: string;
      };
      socket.data.userId = payload.userId;
      next();
    } catch {
      next(new Error("INVALID_TOKEN"));
    }
  });

  io.on("connection", (socket: Socket) => {
    socket.join(`user:${socket.data.userId}`);
    logger.debug(
      { socketId: socket.id, userId: socket.data.userId },
      "WS connected",
    );
    socket.on("disconnect", () => {
      logger.debug({ socketId: socket.id }, "WS disconnected");
    });
  });

  return io;
}

export function emitToUser(userId: string, event: string, data: unknown): void {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
}
