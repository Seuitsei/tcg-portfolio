// Session and motion epochs make late worker replies harmless.
export class AutoRecognition {
 constructor(){this.busy=false;this.reset();}
 reset(reason='reset'){const previousCount=this.count||0;this.epoch=(this.epoch||0)+1;this.id=null;this.count=0;this.last=0;this.lastReset=reason;this.onTrace?.('confirmation_reset',{reason,previousCount,epoch:this.epoch});}
 observe(ready,now=performance.now(),reason='quality'){this.observed=now;if(!ready)this.reset(reason);}
 begin(now){if(this.busy||now-this.last<1200){this.onTrace?.('analysis_deferred',{reason:this.busy?'busy':'cadence'});return null;}this.busy=true;this.last=now;return {epoch:this.epoch,started:now};}
 finish(job,result,now){
  this.busy=false;
  if(job.epoch!==this.epoch){this.onTrace?.('confirmation_ignored',{reason:'epoch',jobEpoch:job.epoch,epoch:this.epoch});return null;}
  const id=strongIdentity(result);
  if(!id||now-job.started>10000||now-this.observed>1000){this.reset(!id?'not_strong':now-job.started>10000?'analysis_expired':'frames_expired');return null;}
  if(this.id!==id){if(this.id)this.onTrace?.('confirmation_identity_change',{previousId:this.id,id,previousCount:this.count});this.id=id;this.count=0;}
  this.count++;
  this.onTrace?.('confirmation',{id,count:this.count,durationMs:now-job.started});
  return this.count>=3?id:null;
 }
}
export function strongIdentity(result){
 const candidate=result?.candidates?.[0];
 return result?.kind==='strong'&&!result.unavailable&&candidate?.id&&!candidate.unverified?candidate.id:null;
}
