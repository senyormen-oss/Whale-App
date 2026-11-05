// ---------------------------------------------------------------------------
// Legal copy. THIS IS A DRAFT, not legal advice: have a lawyer qualified in
// Uzbekistan review it before the public launch (see the notes at the bottom).
// Fill in the operator details below once the business entity exists.
// ---------------------------------------------------------------------------

export const LEGAL = {
  /** Who runs the service. Replace with the registered name once you have one. */
  operatorName: 'the Whale team',
  /** A real, monitored address. Shown to users for support and privacy requests. */
  contactEmail: '',
  termsVersion: '2026-11-05',
  privacyVersion: '2026-11-05',
  lastUpdated: '5 November 2026',
}

export interface LegalSection {
  heading: string
  body: string[]
}

const contact = () =>
  LEGAL.contactEmail
    ? `You can contact us at ${LEGAL.contactEmail}.`
    : 'You can contact us through the support option published in the app.'

export const TERMS: LegalSection[] = [
  {
    heading: '1. About Whale',
    body: [
      `Whale is an online marketplace operated by ${LEGAL.operatorName} ("Whale", "we"). It lets clients discover independent creative and digital specialists (photographers, videographers, designers, marketers and similar) and arrange bookings with them.`,
      'By creating an account or using the service you agree to these Terms. If you do not agree, do not use Whale.',
    ],
  },
  {
    heading: '2. Our role',
    body: [
      'Whale is a platform. Specialists are independent professionals, not employees or agents of Whale. A booking is an agreement between the client and the specialist. Whale is not a party to that agreement and does not guarantee the quality, safety, legality or timing of any service.',
      'Specialist profiles, portfolios, ratings and reviews are provided by users. We do not verify every statement made by users.',
    ],
  },
  {
    heading: '3. Accounts',
    body: [
      'You must be at least 18 years old and provide accurate information. You are responsible for keeping your password confidential and for all activity under your account.',
      'You may close your account at any time from Profile → Settings → Delete account. Closing it permanently erases your profile, bookings, messages and favorites.',
    ],
  },
  {
    heading: '4. Bookings and payments',
    body: [
      'Clients choose a date, time and package. A time slot is reserved for the client who books it first. Bookings can be cancelled by the client from the My Bookings screen before the session; cancelling releases the slot.',
      'Payments: online payment processing is not yet active in this version of the service. Any payment screen shown is a demonstration and no money is charged or held. When payment processing is introduced, these Terms will be updated and you will be asked to accept the new version before using it.',
    ],
  },
  {
    heading: '5. Reviews and content',
    body: [
      'Only a client who completed a booking may review it, once. Reviews must be honest and based on your own experience. You keep ownership of the content you upload, and you grant Whale a non-exclusive licence to host and display it in the service for as long as it is on the service.',
      'You must have the rights to anything you upload (including photos and portfolio items).',
    ],
  },
  {
    heading: '6. Acceptable use',
    body: [
      'Do not: break the law; harass, threaten or discriminate against others; post sexual, violent or deceptive content; impersonate anyone; manipulate ratings or reviews; try to bypass security or access other users\' data; send spam; or use the service to arrange anything illegal.',
      'We may remove content, restrict features or suspend accounts that break these rules or put others at risk.',
    ],
  },
  {
    heading: '7. Liability',
    body: [
      'Whale is provided "as is". To the maximum extent permitted by law, we are not liable for the acts or omissions of users, for missed or poor-quality sessions, or for indirect or consequential losses. Nothing in these Terms limits liability that cannot be limited by law.',
    ],
  },
  {
    heading: '8. Changes and termination',
    body: [
      'We may update these Terms. When the changes are material we will tell you in the app. Continuing to use Whale after an update means you accept it. We may suspend or end the service or an account where needed to protect users or the platform.',
    ],
  },
  {
    heading: '9. Governing law and contact',
    body: [
      'These Terms are governed by the laws of the Republic of Uzbekistan, and disputes are subject to the competent courts there, without limiting any consumer rights you have by law.',
      contact(),
    ],
  },
]

export const PRIVACY: LegalSection[] = [
  {
    heading: '1. What we collect',
    body: [
      'Account data: your name, email address and password (stored only as a secure hash by our authentication provider).',
      'Activity data: bookings you make or receive, messages and photos you send, specialists you save as favorites, reviews you write.',
      'Specialist listings: the profile details you choose to publish (name, city, age, bio, skills, price). These are public.',
      'Technical data needed to run the service, such as your session token. We do not use advertising trackers or third-party analytics.',
    ],
  },
  {
    heading: '2. Why we use it',
    body: [
      'To create and secure your account, to let you book and communicate, to show public specialist profiles and reviews, to prevent abuse and fraud, and to comply with the law.',
    ],
  },
  {
    heading: '3. Who can see your data',
    body: [
      'Your messages and bookings are visible only to you and the other party to that booking or conversation. Specialist listings and reviews are public. A specialist can see the name of clients who booked or wrote to them.',
      'We never sell your data.',
    ],
  },
  {
    heading: '4. Service providers and where data is stored',
    body: [
      'We use Supabase to host the database, authentication and file storage, and Vercel to serve the website. Data is currently stored in a data-centre region outside Uzbekistan, so using Whale involves transferring your data abroad. We will move storage if local data-residency rules require it.',
    ],
  },
  {
    heading: '5. Storage on your device',
    body: [
      'Whale stores only what is strictly necessary on your device: your sign-in session and your notification preference. It does not use advertising or tracking cookies, so no cookie banner is needed.',
    ],
  },
  {
    heading: '6. How long we keep it',
    body: [
      'We keep your data while your account is active. When you delete your account (Profile → Settings → Delete account), your profile, bookings, messages, favorites, uploaded photos and any specialist listing are permanently erased. Reviews you wrote may remain without your name.',
    ],
  },
  {
    heading: '7. Your rights',
    body: [
      'You can access and correct your data in the app, and delete your account at any time. You may also ask us to explain how your data is processed or to stop processing it, subject to applicable law.',
      contact(),
    ],
  },
  {
    heading: '8. Children',
    body: ['Whale is for people aged 18 and over. We do not knowingly collect data from children.'],
  },
  {
    heading: '9. Changes',
    body: ['If we change this policy in a material way we will notify you in the app. The date of the latest update is shown at the top of this page.'],
  },
]

/*
 * Pre-launch legal checklist (for the owner and their lawyer):
 *  - Register the business (e.g. IP / self-employed) and fill in LEGAL.operatorName and a real contact email.
 *  - Uzbekistan's personal-data law (Law on Personal Data) and its data-localisation rules may require
 *    citizens' personal data to be stored on servers in Uzbekistan and the database to be registered.
 *    Confirm with a local lawyer; this is the reason the project may later move to a local server.
 *  - Payment providers (Click, Payme, Uzum) require their own merchant agreements and offer terms.
 *  - Decide on a refund / dispute policy before real payments go live.
 */
