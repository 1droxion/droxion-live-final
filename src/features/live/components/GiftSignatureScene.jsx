import '../styles/live-gift-signature-scenes.css';

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
      <div className="giftDragonEntry">
        <div className="giftDragonAura" />
        <span className="giftDragonGlyph">🐉</span>
        <span className="giftDragonMouthGlow" />
      </div>
      <div className="giftDragonFireBeam">
        <i /><i /><i /><i /><i /><i />
      </div>
      <div className="giftDragonEmbers">
        {Array.from({ length: EMBER_COUNT }, (_, index) => (
          <i
            key={index}
            style={{
              '--ember-y': `${12 + ((index * 37) % 74)}%`,
              '--ember-delay': `${(index % 8) * 70}ms`,
              '--ember-scale': 0.55 + ((index * 13) % 10) / 11
            }}
          />
        ))}
      </div>
      <div className="giftDragonHeatWave" />
    </div>
  );
}

function GalaxyScene() {
  return (
    <div className="giftSignatureScene giftSceneGalaxy" aria-hidden="true">
      <StarField />
      <div className="giftGalaxyOrbit orbitOne" />
      <div className="giftGalaxyOrbit orbitTwo" />
      <div className="giftGalaxyOrbit orbitThree" />
      <div className="giftGalaxyDisc" />
      <div className="giftGalaxyCore" />
      <div className="giftGalaxyBlast" />
    </div>
  );
}

function UniverseScene() {
  return (
    <div className="giftSignatureScene giftSceneUniverse" aria-hidden="true">
      <StarField className="giftUniverseStars" />
      <div className="giftUniverseNebula" />
      <div className="giftUniversePlanet planetA"><span /></div>
      <div className="giftUniversePlanet planetB"><span /></div>
      <div className="giftUniversePlanet planetC"><span /></div>
      <div className="giftUniverseCore" />
      <div className="giftUniverseWave waveOne" />
      <div className="giftUniverseWave waveTwo" />
      <div className="giftUniverseWave waveThree" />
    </div>
  );
}

function RoyaltyScene() {
  return (
    <div className="giftSignatureScene giftSceneRoyalty" aria-hidden="true">
      <div className="giftRoyaltyCurtain left" />
      <div className="giftRoyaltyCurtain right" />
      <div className="giftRoyaltyBeam" />
      <div className="giftRoyaltyFloorGlow" />
      <div className="giftRoyaltyThrone">♛</div>
      <div className="giftRoyaltyCrown">👑</div>
      <div className="giftRoyaltyGems">
        {Array.from({ length: 18 }, (_, index) => (
          <i
            key={index}
            style={{
              '--gem-angle': `${index * 20}deg`,
              '--gem-delay': `${(index % 6) * 85}ms`
            }}
          />
        ))}
      </div>
      <div className="giftRoyaltyFlash" />
    </div>
  );
}

export default function GiftSignatureScene({ scene = '' }) {
  switch (scene) {
    case 'dragon_fire':
      return <DragonScene />;
    case 'galaxy_blast':
      return <GalaxyScene />;
    case 'universe_expand':
      return <UniverseScene />;
    case 'royalty_reveal':
      return <RoyaltyScene />;
    default:
      return null;
  }
}
