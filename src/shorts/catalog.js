export const genres = ['All', 'Romance', 'Thriller', 'Mystery', 'Family'];
export const demoCatalog = [
  { id:'the-last-promise', title:'The Last Promise', genre:'Romance', language:'English', synopsis:'On the night of her engagement, Maya receives a message from someone she thought she had lost. One promise could change everything.', poster_url:'/shorts/promise.jpg', episode_count:10, free_episodes:3, demo:true, episodes:Array.from({length:10},(_,i)=>({id:`promise-${i+1}`,number:i+1,title:['The Message','A Familiar Stranger','The Photograph','Two Versions','The Empty Apartment','What He Knew','Before Midnight','The Other Promise','No More Secrets','The Last Promise'][i]})) }
];
export function validateSeries(value) {
  const row={...value};
  if(!/^[a-z0-9-]{1,80}$/.test(row.id||'')) throw new Error('Series ID must use lowercase letters, numbers and hyphens.');
  if(!String(row.title||'').trim()||String(row.title).length>150) throw new Error('Enter a title of up to 150 characters.');
  if(!genres.slice(1).includes(row.genre)) throw new Error('Choose a supported genre.');
  if(!Number.isInteger(row.free_episodes)||row.free_episodes<1||row.free_episodes>100) throw new Error('Choose 1–100 free episodes.');
  if(!Array.isArray(row.episodes)||!row.episodes.length||row.episodes.length>500) throw new Error('Add between 1 and 500 episodes.');
  row.episodes.forEach((ep,i)=>{if(ep.number!==i+1||!ep.title||!String(ep.storage_path||'').startsWith(row.id+'/')||String(ep.storage_path).includes('..'))throw new Error('Episodes must be consecutive and use paths inside the series folder.');});
  if(row.free_episodes>row.episodes.length) throw new Error('Free episode count exceeds the series length.');
  if(row.poster_url&&!/^https:\/\//.test(row.poster_url)) throw new Error('Poster must be a public HTTPS image URL.');
  return {...row,title:String(row.title).trim(),episode_count:row.episodes.length};
}
