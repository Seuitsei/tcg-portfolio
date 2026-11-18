// Bounded metadata only: never retain JPEGs, pixels, prices or collection contents.
export class ScanDiagnostics {
 constructor(){this.started=performance.now();this.events=[];this.totals={};this.captures=[];this.results={};this.resets={};this.qualityRefusals={};this.clockAlignment=null;this.permissionEvents=[];this.referenceFailures=[];}
 record(event,data={}){
  const row={event,atMs:Math.round((performance.now()-this.started)*10)/10,...data};
  this.totals[event]=(this.totals[event]||0)+1;this.events.push(row);
  if(event==='preview_analysis_result'||event==='photo_analysis_result'){const kinds=this.results[event]||(this.results[event]={strong:0,candidates:0,reject:0});kinds[data.kind]=(kinds[data.kind]||0)+1;}
  if(event==='confirmation_reset')this.resets[data.reason]=(this.resets[data.reason]||0)+1;
  if(event==='frame_quality')for(const reason of data.refusals||[])this.qualityRefusals[reason]=(this.qualityRefusals[reason]||0)+1;
  if(event==='native_clock_alignment')this.clockAlignment=row;
  if(event.startsWith('native_permission'))this.permissionEvents.push(row);
  for(const failure of data.referenceFailures||[])this.referenceFailures.push({...failure,requestId:data.requestId,captureId:data.captureId,atMs:row.atMs});
  if(data.captureId){let capture=this.captures.find(c=>c.id===data.captureId);if(!capture){capture={id:data.captureId,events:[]};this.captures.push(capture);}capture.events.push(row);}
 }
 snapshot(state={}){return {schema:2,clock:'JS performance.now relative to diagnostic start; native times are a separate clock',sensorExposureMeasured:false,...state,clockAlignment:this.clockAlignment,permissionEvents:this.permissionEvents,referenceFailures:this.referenceFailures,totals:this.totals,resultTotals:this.results,resetReasons:this.resets,qualityRefusals:this.qualityRefusals,captures:this.captures,recentEvents:this.events};}
}

const secretKey=/(?:secret|token|password|passwd|authorization|cookie|api[-_]?key|credential|private[-_]?key)/i;
const imageKey=/(?:^|[_-])(?:jpeg|base64|image(?:data|bytes|file|url)?|pixels|blob|photo(?:data|bytes|file|path|token|image)?)(?:$|[_-])/i;
function scrubText(value){
 return value
  .replace(/data:image\/[^\s"']+/gi,'[IMAGE OMITTED]')
  .replace(/\bBearer\s+[^\s"']+/gi,'Bearer [REDACTED]')
  .replace(/(\b(?:api[_-]?key|token|secret|password|authorization)=)[^&\s"']+/gi,'$1[REDACTED]')
  .replace(/https?:\/\/[^\s"'<>]+/gi,raw=>{try{const url=new URL(raw);url.username='';url.password='';url.search='';url.hash='';return url.toString();}catch{return '[URL REDACTED]';}});
}
function scrubValue(value,key=''){
 if(secretKey.test(key)||imageKey.test(key))return undefined;
 if(Array.isArray(value))return value.map(item=>scrubValue(item)).filter(item=>item!==undefined);
 if(value&&typeof value==='object'){const out={};for(const [childKey,child] of Object.entries(value)){const clean=scrubValue(child,childKey);if(clean!==undefined)out[childKey]=clean;}return out;}
 return typeof value==='string'?scrubText(value):value;
}
export function diagnosticExport(snapshot,version,now=new Date()){
 const pad=n=>String(n).padStart(2,'0');
 const stamp=now.getFullYear()+pad(now.getMonth()+1)+pad(now.getDate())+'-'+pad(now.getHours())+pad(now.getMinutes())+pad(now.getSeconds());
 const build=String(version).replace(/[^0-9A-Za-z.-]/g,'');
 const filename=`CraftDrop-diagnostic-${build}-${stamp}.json`;
 const frozen=JSON.parse(JSON.stringify(snapshot));
 return {filename,json:JSON.stringify(scrubValue({...frozen,exportedAt:now.toISOString(),exportVersion:build}),null,2)};
}
