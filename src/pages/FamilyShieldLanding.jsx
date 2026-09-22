import { ArrowRight, CheckCircle2, Link2, MessageSquareText, ShieldAlert, Smartphone, Users } from 'lucide-react';
import './family-shield-landing.css';

const STRIPE_LINK = '';

const features = [
  { Icon: MessageSquareText, title: 'Check suspicious messages', text: 'Paste a text, email, or DM and see the warning signs before you reply.' },
  { Icon: Link2, title: 'Check links and websites', text: 'Review suspicious links before entering passwords, cards, or personal information.' },
  { Icon: Smartphone, title: 'Share to Droxion', text: 'Our planned app flow lets you share suspicious content directly into Droxion for a fast check.' },
  { Icon: Users, title: 'Family alerts', text: 'Planned family protection can warn a trusted person when a high-risk scam is detected.' }
];

export default function FamilyShieldLanding() {
  const checkoutReady = Boolean(STRIPE_LINK);

  function handlePreorder() {
    if (checkoutReady) {
      window.location.href = STRIPE_LINK;
      return;
    }
    document.getElementById('founding-access')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return (
    <main className="shieldLanding">
      <header className="shieldNav">
        <a href="/family-shield" className="shieldBrand">DROXION <span>SHIELD</span></a>
        <button type="button" onClick={handlePreorder}>Founding Access</button>
      </header>

      <section className="shieldHero">
        <div className="shieldBadge"><ShieldAlert size={16} /> PRE-LAUNCH</div>
        <h1>Protect your family from scams <em>before money is lost.</em></h1>
        <p className="shieldLead">Droxion Family Shield is being built to help families check suspicious texts, links, emails, screenshots, and online messages before trusting them.</p>

        <div className="shieldHeroActions">
          <button className="shieldPrimary" type="button" onClick={handlePreorder}>
            Reserve Founding Access — $9.99 <ArrowRight size={18} />
          </button>
          <span>One-time pre-launch preorder. Refundable if Droxion Family Shield does not launch.</span>
        </div>

        <div className="shieldDemoCard" aria-label="Product concept demo">
          <div className="shieldPhone">
            <div className="shieldPhoneTop">Suspicious message</div>
            <div className="shieldMessage">“Your bank account is locked. Verify your identity now at secure-bank-help.co”</div>
            <div className="shieldShare">Share → Droxion</div>
          </div>
          <div className="shieldArrow">→</div>
          <div className="shieldResult">
            <div className="shieldRisk">HIGH RISK</div>
            <h3>Possible impersonation scam</h3>
            <ul>
              <li>Urgent pressure to act</li>
              <li>Suspicious domain</li>
              <li>Requests sensitive information</li>
            </ul>
            <div className="shieldSafe">Safe action: open your bank's official app directly.</div>
          </div>
        </div>
        <p className="shieldDemoNote">Concept demo only. The finished product is not yet available.</p>
      </section>

      <section className="shieldProof">
        <div>
          <strong>$16B</strong>
          <span>reported U.S. fraud losses in 2025</span>
        </div>
        <div>
          <strong>4M+</strong>
          <span>paying Truecaller subscribers reported in 2026</span>
        </div>
        <div>
          <strong>Family-first</strong>
          <span>built around checking before sending money or information</span>
        </div>
      </section>

      <section className="shieldFeatures">
        <div className="shieldSectionHead">
          <span>PLANNED V1</span>
          <h2>One simple job: help you decide whether to trust it.</h2>
        </div>
        <div className="shieldFeatureGrid">
          {features.map(({ Icon, title, text }) => (
            <article key={title}>
              <div><Icon size={22} /></div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="shieldFounding" id="founding-access">
        <div>
          <span className="shieldEyebrow">FOUNDING FAMILY ACCESS</span>
          <h2>$9.99 once.</h2>
          <p>Reserve early access while we validate and build Droxion Family Shield.</p>
          <div className="shieldChecks">
            <span><CheckCircle2 size={17} /> One-time preorder</span>
            <span><CheckCircle2 size={17} /> Founding access</span>
            <span><CheckCircle2 size={17} /> Refundable if the product does not launch</span>
          </div>
        </div>

        <div className="shieldCheckoutCard">
          <strong>$9.99</strong>
          <small>one-time</small>
          <button type="button" onClick={handlePreorder} disabled={!checkoutReady}>
            {checkoutReady ? 'Reserve Founding Access' : 'Secure checkout being connected'}
          </button>
          <p>{checkoutReady ? 'Secure payment handled by Stripe.' : 'The page is live for preview; payment is temporarily disabled until Stripe checkout permission is connected.'}</p>
        </div>
      </section>

      <footer className="shieldFooter">
        <strong>DROXION SHIELD</strong>
        <span>Pre-launch concept. Not a substitute for law enforcement, a bank, or professional fraud investigation.</span>
      </footer>
    </main>
  );
}
