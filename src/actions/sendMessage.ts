"use server";
import { auth } from '@clerk/nextjs/server';
import { chatService } from '@/lib/chat-server';
import { consumeRequestLimit } from '../../server/request-limits';
export async function sendMessage(input:{receiverId:string;text?:string;mediaUrl?:string;mediaType?:string;clientMessageId?:string;mediaAssetId?:string;replyToId?:number}) {
  const {userId}=await auth();
  if(!userId)return null;
  consumeRequestLimit(userId,'message');
  return chatService.sendMessage(userId,input);
}
