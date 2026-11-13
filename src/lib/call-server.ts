import 'server-only';
import { RoomServiceClient } from 'livekit-server-sdk';
import prisma from '@/lib/client';
import { chatService } from '@/lib/chat-server';
import { createRoomService } from '../../server/rooms';
import { createCallCredentials, getLiveKitUrl } from '../../server/call-credentials';

let credentials: ReturnType<typeof createCallCredentials> | undefined;
export function callCredentials() {
  if (credentials) return credentials;
  let livekit: RoomServiceClient | undefined;
  if (process.env.ENABLE_GROUP_CALLS === 'true' && process.env.GROUP_CALL_SECURITY_REVIEWED === 'true' && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET) {
    const url = getLiveKitUrl().replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
    livekit = new RoomServiceClient(url, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
  }
  const rooms = createRoomService({ prisma, chat: chatService, livekit });
  credentials = createCallCredentials({ rooms });
  return credentials;
}
