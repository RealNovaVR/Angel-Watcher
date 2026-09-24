const { PermissionsBitField } = require("discord.js");

const recentMessages = new Map();
const WINDOW_MS = 8000;
const MESSAGE_LIMIT = 6;
const CROSS_CHANNEL_LIMIT = 3;

function normalize(text) {
  return String(text || "").toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g,"").replace(/[\u200B-\u200D\uFEFF]/g,"")
    .replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim();
}
function escapeRegex(v){ return v.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); }
function containsBannedWord(content, words){
  const n=normalize(content);
  return !!n && (words||[]).some(word=>{
    const w=normalize(word); return w && new RegExp(`(^|\\s)${escapeRegex(w)}(?=\\s|$)`,"i").test(n);
  });
}
function trackSpam(message){
  const now=Date.now(), id=message.author.id, list=recentMessages.get(id)||[];
  list.push({time:now,channelId:message.channelId,message});
  const fresh=list.filter(x=>now-x.time<=WINDOW_MS); recentMessages.set(id,fresh);
  return {shouldNuke:fresh.length>=MESSAGE_LIMIT || new Set(fresh.map(x=>x.channelId)).size>=CROSS_CHANNEL_LIMIT,fresh};
}
function canModerate(message){
  if(!message.guild) return false;
  if(message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) return false;
  if(message.member?.permissions.has(PermissionsBitField.Flags.ManageMessages)) return false;
  return true;
}
async function deleteMessages(messages){
  const unique=[...new Map(messages.map(m=>[m.id,m])).values()];
  await Promise.allSettled(unique.map(m=>m.deletable?m.delete().catch(()=>null):null));
}
async function sendLog(message,reason,extra=""){
  const id=message.client.config.modLogChannelId; if(!id)return;
  const ch=await message.client.channels.fetch(id).catch(()=>null); if(!ch?.isTextBased())return;
  await ch.send({embeds:[{title:"🛡️ Moderation Action",color:0x5865F2,
    fields:[{name:"User",value:`${message.author.tag} (${message.author.id})`},{name:"Reason",value:reason},{name:"Channel",value:`<#${message.channelId}>`},
    ...(extra?[{name:"Details",value:extra.slice(0,900)}]:[])],timestamp:new Date().toISOString()}]}).catch(()=>{});
}
async function dm(message,text){ await message.author.send(text).catch(()=>{}); }

async function moderateMessage(message){
  if(!message.guild || message.author.bot || !canModerate(message)) return;
  const config=message.client.config;
  const {shouldNuke,fresh}=trackSpam(message);
  if(shouldNuke){
    await deleteMessages(fresh.map(x=>x.message)); recentMessages.delete(message.author.id);
    await dm(message,`Your recent messages were removed from **${message.guild.name}** because they were detected as spam/flooding. If your account was compromised, secure it immediately and contact staff.`);
    await sendLog(message,"Spam / cross-channel flood",`Deleted ${fresh.length} recent messages.`); return;
  }
  if(containsBannedWord(message.content,config.bannedWords)){
    const deleted=message.deletable ? await message.delete().then(()=>true).catch(()=>false) : false;
    await dm(message,`Your message in **${message.guild.name}** was removed because it contained a word or phrase that is not allowed in this server. Please review the rules and keep messages respectful.`);
    await sendLog(message,"Blocked word",deleted?"Message removed and user notified by DM.":"Message could not be deleted; check Manage Messages permission."); return;
  }
  if(/(https?:\/\/|www\.|discord\.gg\/|discord\.com\/invite\/)/i.test(message.content) &&
     /(free[-\s]?nitro|claim.*reward|steamcommunity.*free|gift.*nitro|verify.*account)/i.test(message.content)){
    if(message.deletable) await message.delete().catch(()=>{});
    await dm(message,`Your message in **${message.guild.name}** was removed because it looked like a suspicious or scam link. If this was legitimate, contact staff.`);
    await sendLog(message,"Suspicious/scam link","Potential phishing or scam pattern.");
  }
}
module.exports={moderateMessage};
