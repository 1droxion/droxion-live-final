import '../styles/live-gift-signature-scenes.css';
import '../styles/live-gift-signature-scenes-v3.css';

const STAR_COUNT = 30;
const EMBER_COUNT = 22;

function StarField({ className = '' }) {
  return (
    <div className={`giftSceneStars ${className}`}>
      {Array.from({ length: STAR_COUNT }, (_, index) => (
        <i
          key={index}
          style={{
            '--scene-star-x': `${3 + ((index * 29) % 94)}%`,
            '--scene-star-y': `${4 + ((index * 47) % 90)}%`,
            '--scene-star-delay': `${(index % 10) * 90}ms`,
            '--scene-star-scale': 0.55 + ((index * 17) % 10) / 10
          }}
        />
      ))}
    </div>
  );
}

function DragonScene() {
  return (
    <div className="giftSignatureScene giftSceneDragon" aria-hidden="true">
      <div className="giftDragonSky" />
      <div className="giftDragonEntry"><div className="giftDragonAura" /><span className="giftDragonGlyph">🐉</span><span className="giftDragonMouthGlow" /></div>
      <div className="giftDragonFireBeam"><i /><i /><i /><i /><i /><i /></div>
      <div className="giftDragonEmbers">{Array.from({ length: EMBER_COUNT }, (_, index) => <i key={index} style={{ '--ember-y': `${12 + ((index * 37) % 74)}%`, '--ember-delay': `${(index % 8) * 70}ms`, '--ember-scale': 0.55 + ((index * 13) % 10) / 11 }} />)}</div>
      <div className="giftDragonHeatWave" />
    </div>
  );
}
function GalaxyScene(){return <div className="giftSignatureScene giftSceneGalaxy" aria-hidden="true"><StarField/><div className="giftGalaxyOrbit orbitOne"/><div className="giftGalaxyOrbit orbitTwo"/><div className="giftGalaxyOrbit orbitThree"/><div className="giftGalaxyDisc"/><div className="giftGalaxyCore"/><div className="giftGalaxyBlast"/></div>}
function UniverseScene(){return <div className="giftSignatureScene giftSceneUniverse" aria-hidden="true"><StarField className="giftUniverseStars"/><div className="giftUniverseNebula"/><div className="giftUniversePlanet planetA"><span/></div><div className="giftUniversePlanet planetB"><span/></div><div className="giftUniversePlanet planetC"><span/></div><div className="giftUniverseCore"/><div className="giftUniverseWave waveOne"/><div className="giftUniverseWave waveTwo"/><div className="giftUniverseWave waveThree"/></div>}
function RoyaltyScene(){return <div className="giftSignatureScene giftSceneRoyalty" aria-hidden="true"><div className="giftRoyaltyCurtain left"/><div className="giftRoyaltyCurtain right"/><div className="giftRoyaltyBeam"/><div className="giftRoyaltyFloorGlow"/><div className="giftRoyaltyThrone">♛</div><div className="giftRoyaltyCrown">👑</div><div className="giftRoyaltyGems">{Array.from({length:18},(_,index)=><i key={index} style={{'--gem-angle':`${index*20}deg`,'--gem-delay':`${(index%6)*85}ms`}}/>)}</div><div className="giftRoyaltyFlash"/></div>}
function LionScene(){return <div className="giftSignatureScene giftSceneLion" aria-hidden="true"><div className="giftLionSun"/><div className="giftLionRing ringOne"/><div className="giftLionRing ringTwo"/><div className="giftLionFace">🦁</div><div className="giftLionCrown">👑</div><div className="giftLionRoarWave"/></div>}
function JetScene(){return <div className="giftSignatureScene giftSceneJet" aria-hidden="true"><div className="giftJetSky"/><div className="giftJetTrail trailA"/><div className="giftJetTrail trailB"/><div className="giftJetPlane">✈️</div><div className="giftJetFlash"/></div>}
function YachtScene(){return <div className="giftSignatureScene giftSceneYacht" aria-hidden="true"><div className="giftYachtSunset"/><div className="giftYachtShine"/><div className="giftYachtBoat">🛥️</div><div className="giftYachtWave waveA"/><div className="giftYachtWave waveB"/><div className="giftYachtSparkle"/></div>}
function PhoenixScene(){return <div className="giftSignatureScene giftScenePhoenix" aria-hidden="true"><div className="giftPhoenixInferno"/><div className="giftPhoenixWing wingLeft"/><div className="giftPhoenixWing wingRight"/><div className="giftPhoenixBird">🔥</div><div className="giftPhoenixHalo"/><div className="giftPhoenixBurst"/></div>}
function ThroneScene(){return <div className="giftSignatureScene giftSceneThrone" aria-hidden="true"><div className="giftThroneColumns left"/><div className="giftThroneColumns right"/><div className="giftThroneBeam"/><div className="giftThroneSeat">🪑</div><div className="giftThroneCrown">👑</div><div className="giftThroneFloor"/></div>}
function WorldCrownScene(){return <div className="giftSignatureScene giftSceneWorldCrown" aria-hidden="true"><StarField/><div className="giftWorldGlobe">🌍</div><div className="giftWorldOrbit orbitA"/><div className="giftWorldOrbit orbitB"/><div className="giftWorldCrown">👑</div><div className="giftWorldShockwave"/></div>}

export default function GiftSignatureScene({ scene = '' }) {
  switch (scene) {
    case 'dragon_fire': return <DragonScene />;
    case 'galaxy_blast': return <GalaxyScene />;
    case 'universe_expand': return <UniverseScene />;
    case 'royalty_reveal': return <RoyaltyScene />;
    case 'lion_roar': return <LionScene />;
    case 'jet_flyby': return <JetScene />;
    case 'yacht_glide': return <YachtScene />;
    case 'phoenix_rise': return <PhoenixScene />;
    case 'throne_ascend': return <ThroneScene />;
    case 'world_crown_orbit': return <WorldCrownScene />;
    default: return null;
  }
}
