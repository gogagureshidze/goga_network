import 'server-only';
import prisma from '@/lib/client';
import { createChatService } from '../../server/chat-service';
export const chatService = createChatService(prisma);
