import { ArrowLeft, Mail, ScanLine } from "lucide-react";
import { SUPPORT_EMAIL } from "../constants.js";

const PAGES = {
  privacy: {
    title: "Privacy Policy",
    updated: "October 11, 2026",
    sections: [
      ["What Droxion Fit processes", "This release supports manual meal logging, groceries and home workouts. It does not upload meal photos for AI analysis. Droxion Fit does not need your contacts, precise location, microphone, or social media accounts."],
      ["Grocery and workout history", "Grocery items, entered prices, budget, and workout completions are stored locally on this device. Sharing a list sends its text through the sharing app you choose. Reset local profile and activity removes these records."],
      ["Meal history", "Your profile and meal diary are stored locally on your device. Any thumbnails from earlier releases remain local until you delete the meals or reset your data."],
      ["Payments", "Subscriptions are processed by Apple or Google. Droxion Fit receives purchase and entitlement information needed to unlock Plus; we do not receive your full payment card details."],
      ["Analytics", "We may collect limited product events such as onboarding completion, scan success or failure, paywall views, and subscription events to improve the app. These events are not used to provide medical diagnoses."],
      ["Nutrition estimates", "Nutrition targets and database values can be inaccurate and should not be used as medical advice or as a substitute for professional care."],
      ["Contact", "Questions about privacy can be sent to " + SUPPORT_EMAIL + "."]
    ]
  },
  terms: {
    title: "Terms of Use",
    updated: "October 11, 2026",
    sections: [
      ["Service", "Droxion Fit is a general wellness and nutrition tracking tool. Nutrition targets and database values may be inaccurate. Verify food values against the package label."],
      ["Not medical advice", "Droxion Fit does not diagnose, treat, prevent, or cure any condition. Do not rely on it for medical, allergy, eating-disorder, or emergency decisions."],
      ["Subscriptions", "Droxion Plus is an auto-renewing subscription offered through Apple App Store or Google Play. The price and billing period shown by your store at purchase are controlling. Manage or cancel through your store account."],
      ["Acceptable use", "Do not attempt to abuse, automate, scrape, reverse engineer, or overload the scanning service or bypass usage limits."],
      ["Availability", "We may update, improve, limit, or discontinue features. Store billing can occasionally be unavailable."],
      ["Contact", "Support questions can be sent to " + SUPPORT_EMAIL + "."]
    ]
  },
  support: {
    title: "Support",
    updated: "",
    sections: [
      ["Logging your meals", "Use Add meal on Today, enter the meal name and nutrition from your food label, then save. Tap a saved meal to edit its values."],
      ["Wrong nutrition estimate", "Tap the result fields before saving, or tap a saved meal later to correct calories and macros."],
      ["Subscription help", "Use Restore Purchases if you already subscribed. Billing and cancellation are managed through your Apple ID or Google Play account."],
      ["Contact", "Email " + SUPPORT_EMAIL + " and include your device type and a short description of the problem. Do not send sensitive health information."]
    ]
  }
};

export default function LegalPage({ page }) {
  const content = PAGES[page] || PAGES.support;
  return (
    <main className="fitLegalPage">
      <header className="fitLegalHeader">
        <a href="/" className="fitIconButton" aria-label="Back"><ArrowLeft size={20} /></a>
        <div className="fitBrand compact"><img className="fitBrandMark" src="/brand-icon.svg" alt="" /><strong>Droxion Fit</strong></div>
      </header>
      <article className="fitLegalContent">
        <span className="fitEyebrow">DROXION FIT</span>
        <h1>{content.title}</h1>
        {content.updated && <p className="fitMuted">Updated {content.updated}</p>}
        {content.sections.map(([heading, body]) => (
          <section key={heading}><h2>{heading}</h2><p>{body}</p></section>
        ))}
        {page === "support" && <a className="fitPrimary fitSupportMail" href={"mailto:" + SUPPORT_EMAIL}><Mail size={18} /> Email support</a>}
      </article>
    </main>
  );
}
