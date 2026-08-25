import { Link, useLocation } from 'react-router-dom';
import './legal-page.css';

const updated = 'August 25, 2026';

const pages = {
  '/privacy': {
    title: 'Privacy Policy',
    intro: 'Droxion Live is a 21+ live social platform. This policy explains the information used to operate Droxion and the choices available to you.',
    sections: [
      ['Information we collect', 'We may collect account information such as email and authentication identifiers; profile information such as display name, username, date of birth, country, language, interests and profile photo; LIVE activity such as session information, viewer presence, chat messages, follows, gifts and guest requests; safety information such as reports and blocks; wallet, creator earning and payout-request records; and technical or usage information needed to operate, secure and improve the service.'],
      ['Camera and microphone', 'Camera and microphone access is requested only when you choose to go LIVE, join a LIVE on camera, or test those permissions. Droxion uses live video and audio to provide real-time communication. The current Droxion LIVE service does not intentionally record LIVE video or audio as a platform recording feature.'],
      ['How we use information', 'We use information to provide accounts and profiles, LIVE discovery and communication, gifts and creator balances, safety and moderation, customer support, fraud prevention, service security, analytics and product improvement.'],
      ['Sharing and service providers', 'Droxion may use infrastructure and service providers such as Supabase for backend services, Vercel for hosting and delivery, and payment or app-store providers where applicable. Information may also be disclosed when required by law or to protect users and the service.'],
      ['Your choices', 'You can edit profile information, control discovery and interaction settings, block users, submit reports, and request account deletion from the Me/Profile section. Account deletion is intended to permanently remove your Droxion account and associated data subject to limited records that may need to be retained for legal, fraud-prevention, dispute or financial-compliance purposes.'],
      ['Age requirement', 'Droxion is intended only for adults age 21 or older. Users who do not meet this requirement are not permitted to use the service.'],
      ['Changes', 'We may update this policy as Droxion changes. Material updates will be reflected by an updated effective date on this page.']
    ]
  },
  '/terms': {
    title: 'Terms of Use',
    intro: 'These Terms govern use of Droxion Live. By using Droxion, you agree to follow these Terms and the Community Guidelines.',
    sections: [
      ['Eligibility', 'You must be at least 21 years old and legally able to enter into these Terms. You are responsible for accurate account information and for activity on your account.'],
      ['LIVE and user content', 'You are responsible for content you stream, post or send. Do not broadcast or share illegal, exploitative, abusive, hateful, threatening, sexually explicit, deceptive or otherwise prohibited content. Droxion may remove content, restrict features, suspend LIVE access or terminate accounts when necessary for safety or compliance.'],
      ['Virtual coins and gifts', 'Droxion coins are virtual items for use within the service and are not money, deposits or transferable property. Purchases in native mobile apps must use the applicable app-store billing system when required. Gift values, availability and pricing may change.'],
      ['Creator earnings', 'Eligible creator gift activity may generate creator earnings subject to Droxion rules, platform commission, payment-store fees where applicable, taxes, refunds, chargebacks, fraud review and payout requirements. Payout requests may be reviewed before payment.'],
      ['Safety and enforcement', 'Users can report and block others. Droxion may investigate suspected violations and take action including content restrictions, LIVE removal, feature limitations, suspension or account termination.'],
      ['Service availability', 'LIVE communications depend on network, device and third-party infrastructure conditions. Droxion may change, suspend or discontinue features as the service evolves.'],
      ['Account termination', 'You may delete your account from the app. Droxion may suspend or terminate accounts that violate these Terms, Community Guidelines, law or platform requirements.']
    ]
  },
  '/community-guidelines': {
    title: 'Community Guidelines',
    intro: 'Droxion is built for adult LIVE social discovery. These rules apply to LIVE broadcasts, chat, profiles, gifts, guest appearances and other interactions.',
    sections: [
      ['Adults only — 21+', 'Do not use Droxion if you are under 21. Do not impersonate a minor or knowingly facilitate access by minors. Report any underage concern immediately.'],
      ['No sexual exploitation or explicit sexual content', 'Sexual exploitation, non-consensual sexual content, sexual services, sexual content involving minors, grooming, trafficking and explicit sexual activity are prohibited.'],
      ['No harassment, hate or threats', 'Do not bully, stalk, threaten, dox, degrade or target people with hateful conduct based on protected characteristics.'],
      ['No dangerous or illegal activity', 'Do not promote credible violence, self-harm encouragement, illegal drugs, weapons trafficking, fraud, scams, exploitation or other illegal activity.'],
      ['No spam or deception', 'Do not impersonate others, manipulate users, run scams, send repetitive spam or misrepresent gifts, earnings, identity or relationships.'],
      ['Use safety tools', 'Use Report when content or behavior violates these rules. Use Block to stop interactions with a creator or user. Hosts should remove disruptive guests and end unsafe LIVE sessions.'],
      ['Enforcement', 'Droxion may remove access to LIVE, restrict accounts, preserve relevant safety records, suspend users or permanently terminate accounts depending on severity and repeat behavior.']
    ]
  },
  '/child-safety': {
    title: 'Child Safety Standards',
    intro: 'Droxion Live is an adults-only 21+ service and has zero tolerance for child sexual abuse and exploitation (CSEA), child sexual abuse material (CSAM), grooming, sexualization of minors, trafficking, sextortion, or any other conduct that exploits or endangers a child.',
    sections: [
      ['Adults only — 21+', 'Droxion is intended only for people age 21 or older. Minors are not permitted to create or use Droxion accounts. Users must not impersonate a minor, help a minor access the service, or use Droxion to seek contact with minors.'],
      ['Zero tolerance for CSEA and CSAM', 'Droxion prohibits creating, uploading, streaming, requesting, sharing, linking to, promoting or facilitating child sexual abuse material or sexual exploitation of children. Grooming, sexual solicitation of minors, trafficking, sextortion, sexualized role-play involving minors, and attempts to normalize or coordinate such conduct are prohibited.'],
      ['In-app reporting and blocking', 'During a LIVE, users can open the LIVE Safety menu to report harmful content or behavior, including an Underage concern or Sexual content report, and can block the creator. Users can also report users from LIVE chat safety options. Reports are recorded for moderation review.'],
      ['Review and enforcement', 'Droxion reviews safety reports and may end or restrict LIVE access, remove or limit content, restrict features, suspend or permanently terminate accounts, block interactions, and preserve relevant safety records when necessary for investigation, enforcement or legal compliance.'],
      ['Reporting to authorities', 'Droxion complies with applicable child-safety laws and lawful requests. When Droxion becomes aware of apparent child sexual abuse material or child sexual exploitation, it will take appropriate action consistent with applicable law, including preserving relevant information and making reports to appropriate regional or national authorities or designated reporting organizations when legally required.'],
      ['Safety contact', 'Child-safety concerns may also be sent to patelsuchitbhai@gmail.com. This contact is designated to receive and respond to child-safety and CSAM/CSEA compliance concerns for Droxion. For an immediate threat to a child or any person, contact the appropriate local emergency or law-enforcement service.'],
      ['Ongoing standards', 'Droxion may update these standards as the service, applicable law, and platform requirements evolve. These standards apply across LIVE broadcasts, chat, profiles, guest appearances and other user interactions.']
    ]
  },
  '/support': {
    title: 'Droxion Support',
    intro: 'For account, LIVE, safety, wallet or creator-support issues, signed-in users can open Me → Help & Support and send a support request directly to Droxion.',
    sections: [
      ['Safety issues', 'If you encounter harmful behavior during a LIVE, use the LIVE safety menu to Report or Block the creator. For child-safety standards and reporting information, see the Child Safety Standards page. For immediate danger, contact the appropriate local emergency service.'],
      ['Account access', 'Use the sign-in and account recovery options available in Droxion. If you can access your account, Me → Help & Support is the fastest way to send account-specific details.'],
      ['Account deletion', 'Signed-in users can permanently request account deletion from Me/Profile using Delete Account.'],
      ['App review access', 'Droxion is a LIVE social service. Camera and microphone features require permission and two test accounts may be useful for testing host/viewer interactions.']
    ]
  }
};

export default function LegalPage() {
  const { pathname } = useLocation();
  const page = pages[pathname] || pages['/support'];
  return (
    <main className="legalShell">
      <div className="legalTop"><Link to="/">← Droxion</Link><span>LIVE SOCIAL</span></div>
      <article className="legalCard">
        <h1>{page.title}</h1>
        <div className="legalUpdated">Effective {updated}</div>
        <p className="legalIntro">{page.intro}</p>
        {page.sections.map(([title, body]) => <section key={title}><h2>{title}</h2><p>{body}</p></section>)}
        <div className="legalLinks"><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/community-guidelines">Community Guidelines</Link><Link to="/child-safety">Child Safety</Link><Link to="/support">Support</Link></div>
      </article>
    </main>
  );
}