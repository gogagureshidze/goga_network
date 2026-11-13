'use server';
import {auth} from '@clerk/nextjs/server';
import prisma from '@/lib/client';
export async function searchUsers(query:string) {
  const {userId}=await auth();if(!userId)return [];
  if(typeof query!=='string'||query.length>80)return [];
  const term=query.trim();
  return prisma.user.findMany({where:{AND:[{blocks:{none:{blockedId:userId}}},{blockedBy:{none:{blockerId:userId}}},...(term?[{OR:[{username:{contains:term}},{name:{contains:term}}]}]:[])]},select:{id:true,username:true,name:true,avatar:true},orderBy:{username:'asc'},take:20});
}
