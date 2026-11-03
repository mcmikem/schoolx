import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
const repo='/Users/me/schoolx-git';
const env=Object.fromEntries(fs.readFileSync(repo+'/.env.local','utf8').split('\n').map(x=>x.match(/^([^=]+)=(.*)$/)).filter(Boolean).map(([,k,v])=>[k,v.replace(/^['"]|['"]$/g,'')]));
const s=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const dir=repo+'/.agents/skills/video-shotcraft/template/out/real-recordings';
for (const n of ['fees','timetable','qr-attendance','library','report-cards','homework']) {
  const dest=`onboarding/review-real-${n}.mp4`;
  const r=await s.storage.from('app-videos').upload(dest,fs.readFileSync(path.join(dir,`real-ob-${n}.mp4`)),{contentType:'video/mp4',upsert:true});
  if(r.error) throw r.error;
  console.log(`${n}\t${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/app-videos/${dest}`);
}
