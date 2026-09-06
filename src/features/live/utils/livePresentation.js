const LIVE_USER_COLORS = [
  '#c084fc','#f472b6','#60a5fa','#22d3ee','#34d399','#facc15','#fb923c','#f87171','#a78bfa','#2dd4bf'
];

const CINEMA_DURATION_SCALE = 0.62;

const SIGNATURE_GIFT_CONFIG = {
  rose:{scene:'rose_petals',soundProfile:'rose',duration:1800,takeoverLevel:'light'},
  heart:{scene:'heart_pulse',soundProfile:'heart',duration:1850,takeoverLevel:'light'},
  neon_bloom:{scene:'neon_bloom',soundProfile:'neon',duration:1900,takeoverLevel:'light'},
  lucky_seven:{scene:'lucky_seven',soundProfile:'lucky',duration:1950,takeoverLevel:'light'},
  star:{scene:'star_burst',soundProfile:'star',duration:1900,takeoverLevel:'light'},
  finger_heart:{scene:'finger_heart',soundProfile:'finger_heart',duration:1900,takeoverLevel:'light'},
  candy_pop:{scene:'candy_pop',soundProfile:'candy',duration:1950,takeoverLevel:'light'},
  coffee:{scene:'coffee_steam',soundProfile:'coffee',duration:1950,takeoverLevel:'light'},
  sparkle:{scene:'sparkle_rain',soundProfile:'sparkle',duration:1950,takeoverLevel:'light'},
  soccer_strike:{scene:'soccer_strike',soundProfile:'soccer',duration:2050,takeoverLevel:'light'},
  teddy:{scene:'teddy_hug',soundProfile:'teddy',duration:2100,takeoverLevel:'light'},
  hello_wave:{scene:'hello_wave',soundProfile:'wave',duration:2050,takeoverLevel:'light'},
  crown:{scene:'crown_drop',soundProfile:'crown',duration:2200,takeoverLevel:'medium'},
  snapshot:{scene:'snapshot_flash',soundProfile:'camera',duration:2100,takeoverLevel:'medium'},
  cake:{scene:'cake_party',soundProfile:'cake',duration:2250,takeoverLevel:'medium'},
  game_on:{scene:'game_on',soundProfile:'game',duration:2250,takeoverLevel:'medium'},
  fire:{scene:'fire_wave',soundProfile:'fire',duration:2300,takeoverLevel:'medium'},
  chocolate_box:{scene:'chocolate_box',soundProfile:'chocolate',duration:2250,takeoverLevel:'medium'},
  party_drop:{scene:'party_drop',soundProfile:'party',duration:2300,takeoverLevel:'medium'},
  rocket:{scene:'rocket_launch',soundProfile:'rocket',duration:2400,takeoverLevel:'medium'},
  magic_mirror:{scene:'magic_mirror',soundProfile:'mirror',duration:2450,takeoverLevel:'high'},
  diamond:{scene:'diamond_prism',soundProfile:'diamond',duration:2500,takeoverLevel:'high'},
  music_drop:{scene:'music_drop',soundProfile:'music',duration:2500,takeoverLevel:'high'},
  supercar:{scene:'supercar_drive',soundProfile:'supercar',duration:2550,takeoverLevel:'high'},
  angel_wings:{scene:'angel_wings',soundProfile:'angel',duration:2600,takeoverLevel:'high'},
  treasure:{scene:'treasure_open',soundProfile:'treasure',duration:2600,takeoverLevel:'high'},
  electric_orb:{scene:'electric_orb',soundProfile:'electric',duration:2650,takeoverLevel:'high'},
  castle:{scene:'castle_reveal',soundProfile:'castle',duration:2700,takeoverLevel:'high'},
  moon_kiss:{scene:'moon_kiss',soundProfile:'moon',duration:2700,takeoverLevel:'high'},
  dragon:{scene:'dragon_fire',soundProfile:'dragon',duration:2850,takeoverLevel:'high'},
  droxion_galaxy:{scene:'galaxy_blast',soundProfile:'galaxy',duration:3000,takeoverLevel:'full'},
  lion:{scene:'lion_roar',soundProfile:'lion',duration:2950,takeoverLevel:'full'},
  private_jet:{scene:'jet_flyby',soundProfile:'jet',duration:2900,takeoverLevel:'full'},
  yacht:{scene:'yacht_glide',soundProfile:'yacht',duration:2950,takeoverLevel:'full'},
  phoenix:{scene:'phoenix_rise',soundProfile:'phoenix',duration:3050,takeoverLevel:'full'},
  meteor_storm:{scene:'meteor_storm',soundProfile:'meteor',duration:3100,takeoverLevel:'full'},
  droxion_universe:{scene:'universe_expand',soundProfile:'universe',duration:3200,takeoverLevel:'full'},
  royal_throne:{scene:'throne_ascend',soundProfile:'throne',duration:3200,takeoverLevel:'full'},
  world_crown:{scene:'world_crown_orbit',soundProfile:'world_crown',duration:3250,takeoverLevel:'full'},
  droxion_royalty:{scene:'royalty_reveal',soundProfile:'royalty',duration:3300,takeoverLevel:'full'}
};

const NAME_TO_CODE = Object.keys(SIGNATURE_GIFT_CONFIG).map(code => [new RegExp(code.replace(/_/g,'[ _-]'),'i'),code]);

function hashText(value){let hash=2166136261;const text=String(value||'viewer');for(let i=0;i<text.length;i+=1){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619)}return Math.abs(hash>>>0)}
function tierForCode(code,cost){if(['meteor_storm','droxion_universe','royal_throne','world_crown','droxion_royalty'].includes(code)||cost>=20000)return'legendary';if(['droxion_galaxy','lion','private_jet','yacht','phoenix'].includes(code)||cost>=5000)return'elite';if(cost>=650)return'premium';if(cost>=75)return'featured';return'standard'}
function fasterDuration(ms){return Math.max(850,Math.round(Number(ms||0)*CINEMA_DURATION_SCALE))}
export function getLiveUserColor(userId,displayName){const key=String(userId||displayName||'viewer');return LIVE_USER_COLORS[hashText(key)%LIVE_USER_COLORS.length]}
export function getGiftPresentation(gift={}){const cost=Number(gift.cost_coins??gift.coin_cost??gift.coins??0);const code=String(gift.gift_code||gift.code||'').toLowerCase();const name=String(gift.gift_name||gift.name||'').toLowerCase();const key=`${code} ${name}`;const resolvedCode=SIGNATURE_GIFT_CONFIG[code]?code:NAME_TO_CODE.find(([pattern])=>pattern.test(key))?.[1];if(resolvedCode&&SIGNATURE_GIFT_CONFIG[resolvedCode]){const config=SIGNATURE_GIFT_CONFIG[resolvedCode];return{tier:tierForCode(resolvedCode,cost),...config,duration:fasterDuration(config.duration)}}if(cost>=20000)return{tier:'legendary',duration:fasterDuration(3200),scene:'legendary_generic',soundProfile:'legendary_stinger',takeoverLevel:'full'};if(cost>=5000)return{tier:'elite',duration:fasterDuration(2900),scene:'elite_generic',soundProfile:'elite_impact',takeoverLevel:'high'};if(cost>=750)return{tier:'premium',duration:fasterDuration(2500),scene:'premium_generic',soundProfile:'premium_whoosh',takeoverLevel:'medium'};if(cost>=75)return{tier:'featured',duration:fasterDuration(2200),scene:'featured_generic',soundProfile:'sparkle_chime',takeoverLevel:'light'};return{tier:'standard',duration:fasterDuration(1800),scene:'standard_generic',soundProfile:'standard_pop',takeoverLevel:'light'}}
