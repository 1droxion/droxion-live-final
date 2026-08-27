import { useEffect, useMemo, useState } from 'react';
import { Gift, Send, X } from 'lucide-react';
import { getGiftPresentation, getLiveUserColor } from '../utils/livePresentation';
import '../styles/live-interaction-overlay.css';

export default function LiveInteractionOverlay({
  messages = [],
  giftEvents = [],
  giftOptions = [],
  coins = 0,
  draft = '',
  onDraftChange,
  onSendChat,
  sendingChat = false,
  giftDrawerOpen = false,
  onGiftDrawerChange,
  onSendGift,
  busyGift = '',
  onOpenWallet
}) {
  const [activeGift, setActiveGift] = useState(null);

  const combinedEvents = useMemo(() => [
    ...messages.slice(-7).map(row => ({ ...row, eventType: 'chat', eventKey: `chat-${row.id}` })),
    ...giftEvents.slice(-4).map(row => ({ ...row, eventType: 'gift', eventKey: `gift-${row.id}` }))
  ].sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || ''))).slice(-8), [messages, giftEvents]);

  useEffect(() => {
    const latestGift = giftEvents[giftEvents.length - 1];
    if (!latestGift) return undefined;

    const presentation = getGiftPresentation(latestGift);
    setActiveGift({ ...latestGift, ...presentation, animationKey: `${latestGift.id || latestGift.created_at || Date.now()}` });
    const timer = window.setTimeout(() => setActiveGift(null), presentation.duration);
    return () => window.clearTimeout(timer);
  }, [giftEvents]);

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onSendChat?.();
    }
  }

  return (
    <>
      <div className="liveProChat" aria-live="polite">
        {combinedEvents.length === 0 && <div className="liveProChatHint">Live chat will appear here.</div>}
        {combinedEvents.map(event => {
          const color = getLiveUserColor(event.sender_id || event.user_id, event.display_name);
          return event.eventType === 'gift' ? (
            <div className="liveProChatLine liveProGiftLine" key={event.eventKey}>
              <strong style={{ color }}>{event.display_name || 'Viewer'}</strong>
              <span>sent {event.emoji || '🎁'} {event.gift_name || 'a gift'}</span>
            </div>
          ) : (
            <div className="liveProChatLine" key={event.eventKey}>
              <strong style={{ color }}>{event.display_name || 'Viewer'}</strong>
              <span>{event.body}</span>
            </div>
          );
        })}
      </div>

      <div className="liveProComposer">
        <div className="liveProInputWrap">
          <input
            value={draft}
            onChange={event => onDraftChange?.(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a message"
            maxLength={500}
            aria-label="Live chat message"
          />
        </div>
        <button type="button" className="liveProGiftButton" onClick={() => onGiftDrawerChange?.(true)} aria-label="Send gift">
          <Gift size={20} />
        </button>
        <button type="button" className="liveProSendButton" onClick={() => onSendChat?.()} disabled={!draft.trim() || sendingChat} aria-label="Send message">
          <Send size={19} />
        </button>
      </div>

      {giftDrawerOpen && (
        <div className="liveProGiftBackdrop" onClick={() => onGiftDrawerChange?.(false)}>
          <section className="liveProGiftSheet" onClick={event => event.stopPropagation()} aria-label="Send a LIVE gift">
            <div className="liveProGiftGrabber" />
            <header className="liveProGiftHeader">
              <div>
                <span className="liveProGiftEyebrow">SUPPORT THE CREATOR</span>
                <strong>Send a gift</strong>
                <small>Balance · 🪙 {coins}</small>
              </div>
              <button type="button" onClick={() => onGiftDrawerChange?.(false)} aria-label="Close gifts"><X size={20} /></button>
            </header>

            <div className="liveProGiftGrid">
              {giftOptions.map(gift => {
                const presentation = getGiftPresentation(gift);
                return (
                  <button
                    type="button"
                    key={gift.gift_code}
                    className={`liveProGiftCard ${presentation.tier}`}
                    disabled={Boolean(busyGift)}
                    onClick={() => onSendGift?.(gift)}
                  >
                    <span className="liveProGiftEmoji">{gift.emoji || '🎁'}</span>
                    <strong>{gift.gift_name}</strong>
                    <small>🪙 {gift.cost_coins}</small>
                    {presentation.tier === 'premium' && <em>Premium</em>}
                    {presentation.tier === 'featured' && <em>Featured</em>}
                  </button>
                );
              })}
            </div>

            <button type="button" className="liveProWalletButton" onClick={() => onOpenWallet?.()}>Get more coins</button>
          </section>
        </div>
      )}

      {activeGift && (
        <div className={`liveGiftCinema ${activeGift.tier}`} key={activeGift.animationKey} aria-hidden="true">
          <div className="liveGiftCinemaGlow" />
          <div className="liveGiftCinemaParticles"><i /><i /><i /><i /><i /><i /></div>
          <div className="liveGiftCinemaCard">
            <div className="liveGiftCinemaEmoji">{activeGift.emoji || '🎁'}</div>
            <div className="liveGiftCinemaCopy">
              <strong style={{ color: getLiveUserColor(activeGift.sender_id || activeGift.user_id, activeGift.display_name) }}>{activeGift.display_name || 'Viewer'}</strong>
              <span>sent {activeGift.gift_name || 'a gift'}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
