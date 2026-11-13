"use server";
import { auth } from '@clerk/nextjs/server';
import { chatService } from '@/lib/chat-server';
import { consumeRequestLimit } from '../../server/request-limits';
export async function getMessages(friendId:string,olderThan?:number) {
  const {userId}=await auth();
  if(!userId)return null;
  consumeRequestLimit(userId, 'history');
  return chatService.getMessages(userId,{receiverId:friendId,before:olderThan,limit:10});
}
