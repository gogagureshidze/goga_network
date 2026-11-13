import 'server-only';
import prisma from '@/lib/client';
import { chatService } from './chat-server';
import { createMediaService } from '../../server/media-policy';
import { createVoiceStorage } from '../../server/voice-storage';

let storage: ReturnType<typeof createVoiceStorage> | undefined;
export function mediaStorage() {
  storage ??= createVoiceStorage();
  return storage;
}
export const mediaService = createMediaService({
  prisma, chat: chatService,
  upload: (bytes: Buffer, publicId: string) => mediaStorage().upload(bytes, publicId),
  destroy: (publicId: string) => mediaStorage().destroy(publicId),
});
