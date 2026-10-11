// Only complete, source-checked records may supply a corrective answer.
// This runs after model review so a vague or contradictory draft is not cached.
export function concreteMechanicsReply(reply, facts, question, intent) {
 const q=String(question||'');
 if(!/(馴服|餵|吃什麼|食物|減少血|降低血|壓血|打殘)/.test(q))return reply;
 if(!/馴服/.test(q)&&/(繁殖|生小|幼體|成長|回血|治療|騎乘|已馴服)/.test(q))return reply;
 const focus=intent?.focus||[];
 const candidates=facts.filter(f=>f.runtimeVerified&&f.taming&&[f.taming.subject,...(f.taming.aliases||[])].some(name=>q.includes(name)||focus.includes(name)));
 // Do not silently choose a species when the player is comparing several.
 if(candidates.length!==1)return reply;
 const fact=candidates[0],t=fact.taming;
 const health=/(血|打殘|戰鬥|攻擊)/.test(q),food=!health&&/(餵什麼|吃什麼|食物|要餵|餵啥)/.test(q)&&!/(怎麼馴服|如何馴服)/.test(q);
 const facet=health?'health':food?'food':'tame';
 const requirements=t.requirements?.[facet]||[];
 const text=String(reply.answer||'');
 const specific=requirements.every(group=>group.some(term=>text.includes(term)));
 // Explicit reviewed contradictions are species-specific data, not guesses.
 const contradicts=(t.contradictions||[]).some(pattern=>new RegExp(pattern).test(text));
 const factId=String(facts.indexOf(fact)+1);
 if(specific&&!contradicts)return reply.factIds?.includes(factId)?reply:{...reply,factIds:[factId]};
 const answer=t.answers?.[facet];
 return answer?{...reply,answer,factIds:[factId]}:reply;
}
