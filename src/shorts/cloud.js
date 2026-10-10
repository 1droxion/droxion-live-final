// Public client configuration; access is enforced by Supabase RLS.
const origin=String(import.meta.env.VITE_SHORTS_SUPABASE_URL||'https://zlnhaqzawbzagraxhmlb.supabase.co').replace(/\/$/,'');
const key=import.meta.env.VITE_SHORTS_SUPABASE_ANON_KEY||'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpsbmhhcXphd2J6YWdyYXhobWxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NTkzMDYsImV4cCI6MjA5OTUzNTMwNn0.kAF2dFpb3SljU0naxAIbbK65bdfL7fvHc8da1jIRGBE';
export const cloudReady=!!(origin&&key);
let session=null;
try{session=JSON.parse(sessionStorage.getItem('shorts-session')||'null')}catch{}
export function currentSession(){return session;}
function persist(value){session=value;try{value?sessionStorage.setItem('shorts-session',JSON.stringify(value)):sessionStorage.removeItem('shorts-session')}catch{}}
async function call(path,{method='GET',body,headers={},raw=false}={}){
 if(!cloudReady)throw new Error('Cloud catalogue is not connected yet.');
 if(session?.expires_at&&session.expires_at*1000<Date.now()+30000){const response=await fetch(origin+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});const data=await response.json();if(!response.ok){persist(null);throw new Error('Please sign in again.')}persist(data)}
 const response=await fetch(origin+path,{method,headers:{apikey:key,Authorization:'Bearer '+(session?.access_token||key),...(!raw?{'Content-Type':'application/json'}:{}),...headers},body:body===undefined?undefined:raw?body:JSON.stringify(body)});
 const data=await response.json().catch(()=>null);if(!response.ok)throw new Error(data?.msg||data?.message||data?.error_description||data?.error||'Request failed.');return data;
}
export async function login(email,password){const data=await call('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});persist(data);return data;}
export async function logout(){try{await call('/auth/v1/logout',{method:'POST'})}finally{persist(null)}}
export async function getCatalog(){const series=await call('/rest/v1/shorts_series?select=*&published=eq.true&order=created_at.desc');const episodes=await call('/rest/v1/shorts_episodes?select=id,series_id,number,title&order=number.asc');return series.map(s=>({...s,episodes:episodes.filter(e=>e.series_id===s.id),episode_count:episodes.filter(e=>e.series_id===s.id).length}));}
export async function getAdmin(){const rows=await call('/rest/v1/shorts_admins?select=user_id');return rows?.some(r=>r.user_id===session?.user?.id);}
export async function getVideo(episodeId){return call('/rest/v1/rpc/shorts_video_path',{method:'POST',body:{episode_id:episodeId}}).then(async path=>{if(!path)throw new Error('This episode requires access.');const result=await call('/storage/v1/object/sign/shorts-videos/'+path.split('/').map(encodeURIComponent).join('/'),{method:'POST',body:{expiresIn:3600}});const signed=result.signedURL||result.signedUrl;if(!signed)throw new Error('Video URL unavailable.');return {url:signed.startsWith('http')?signed:origin+'/storage/v1'+signed};});}
export async function uploadVideo(path,file){return call('/storage/v1/object/shorts-videos/'+path.split('/').map(encodeURIComponent).join('/'),{method:'POST',raw:true,body:file,headers:{'Content-Type':file.type||'video/mp4','x-upsert':'false'}})}
export async function publishSeries(series){return call('/rest/v1/rpc/shorts_publish',{method:'POST',body:{series_data:series}})}
export async function checkAccess(){if(!session)return false;const rows=await call('/rest/v1/shorts_access?select=expires_at&expires_at=gt.'+encodeURIComponent(new Date().toISOString()));return rows?.length>0;}
