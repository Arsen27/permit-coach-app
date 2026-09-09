\# PermitCoach Privacy Policy

**Effective date:** August 15, 2026

This Privacy Policy explains how PermitCoach (the "App," "PermitCoach," "we,"
"us," or "our") collects, uses, discloses, retains, and protects information
when you use the PermitCoach mobile app on iOS or Android or contact us about
the App.

> **Independent-app notice.** PermitCoach is a private, unofficial educational
> app. It is not a government service and is not affiliated with, endorsed by,
> approved by, sponsored by, authorized by, administered by, or operated by any
> U.S. federal, state, or local government agency. This includes every
> Department of Motor Vehicles (DMV), the California DMV, the Texas Department
> of Public Safety (Texas DPS), and the Florida Department of Highway Safety and
> Motor Vehicles (FLHSMV). References and links to those agencies identify the
> relevant official source only and do not imply any relationship or
> endorsement. The same applies to every additional U.S. state, territory, or
> jurisdiction for which PermitCoach may offer educational content in the
> future.

Questions or privacy requests: **support@permitcoach.app**.

## Summary

- PermitCoach creates a pseudonymous account identifier so progress and
  subscription access can work without registration. Email sign-up and Apple
  or Google sign-in are optional.
- We process study progress, onboarding choices, subscription information,
  device and usage analytics, and limited technical information.
- PostHog receives an IP address to accept an analytics request, but we disable
  its GeoIP enrichment so it is not used to derive approximate city or region.
  The App does not request or collect precise GPS location.
- We do not show third-party ads, sell personal information, or share personal
  information for cross-context behavioral advertising. We do not use IDFA or
  AAID for advertising or track your activity across unrelated apps or
  websites.
- The App does not access your contacts, photos, camera, or microphone and does
  not accept user-generated public content.
- Account deletion and subscription cancellation are separate. Deleting the
  App or a PermitCoach account does not cancel an Apple App Store or Google Play
  subscription.

## Information we collect

### Pseudonymous account and authentication information

When backend connectivity is available, the App creates an anonymous Supabase
account and assigns it a random UUID. A UUID is not your name, but because it is
persistent and is used across our database, PostHog, and RevenueCat, we treat it
as personal information. Activity and device information can be associated with
this identifier even if you never provide an email address.

If you choose to register or sign in, we also process:

- **Email and password.** The App transmits these to Supabase Auth for
  authentication. We do not store your password in readable form; Supabase
  maintains the authentication credential using its security controls.
- **Apple or Google sign-in data.** We receive an identity token and the email
  and name made available by the provider. Apple may provide a private relay
  address and normally provides a name only on the first authorization.
- **Profile information.** A display name you set or that is obtained from an
  identity provider, your selected state, appearance settings, and plan status.

### Study progress

The following is stored on the device and, once a Supabase session exists,
synced to our servers:

- lesson progress, answer counts, correct-answer counts, scores, points, and
  completion status;
- topic scores and best mock-exam score;
- per-question history, including question identifier, number of attempts,
  number correct, and whether the most recent answer was correct;
- current and longest study streak, days studied, and last active date; and
- saved questions, saved signs, and mistake lists.

Question identifiers can reveal the topic you studied. We therefore treat
study history as personal information even though it does not contain an
official test result.

### Onboarding, test-date, and reminder information

During onboarding, PermitCoach asks about your study reason, permit status,
past attempts, preparedness, age range, and whether you have a planned test
date. It may also ask which days and time you prefer for study reminders.

- The selected answers and exact test date, if supplied, are saved locally on
  the device.
- PostHog receives the selected option identifiers, including the age-band
  choice, and whether a test is scheduled. For a scheduled test, analytics
  receives the number of days until the test rather than the exact calendar
  date.
- PostHog receives the number of reminder days and the selected reminder time,
  but not the specific weekdays.
- The App asks the operating system for notification permission and records the
  permission outcome in analytics. Reminder preferences are stored locally.
  PermitCoach does not currently operate a remote push-notification service or
  collect a push token.

### Subscription and purchase information

Apple or Google processes payment. We do not receive your full payment-card
number or store-account password. RevenueCat and the applicable store process
information such as:

- the PermitCoach/RevenueCat user identifier and store transaction or receipt
  identifier;
- product identifier, offering, subscription and entitlement status;
- price, currency, purchase, renewal, expiration, cancellation, and refund
  timestamps or status; and
- platform, app version, device/app technical information, and information
  necessary to validate and restore purchases.

Our PostHog events also record product identifiers and purchase, restore,
paywall, and entitlement outcomes.

### Product analytics and technical information

We use PostHog Cloud in the United States to understand and improve the App.
Analytics is associated with the PermitCoach UUID and may include:

- app lifecycle and screen-view events;
- lesson, question, quiz, sign, streak, onboarding, authentication, settings,
  paywall, purchase, and external-link events;
- question, lesson, sign, topic, and route identifiers; answer correctness;
  counts, scores, percentages, and time spent or completion duration;
- device model or type, operating system and version, app version, SDK version,
  device language/locale, and similar app/device metadata;
- selected state, subscription plan, display preferences, progress totals, and
  whether an optional registered identity is attached; and
- email and display name on the PostHog person profile if available.

PostHog receives the network IP address as part of request delivery, but the
App sets `disableGeoip` so PostHog is instructed not to enrich events with an
approximate country, region, or city derived from that address. We do not
request GPS permission or collect precise location. Service providers may
still process IP addresses transiently or in security and technical logs.

Session replay and touch autocapture are disabled. We do not intentionally
send passwords, typed authentication fields, official question text, or
free-form onboarding answers to PostHog. Error or failure events can include a
technical error reason but are not intended to contain user-authored content.

### Content requests, server logs, and support communications

When the App checks for or downloads course content, our hosting provider and
other network providers may process IP address, request path, timestamps,
response status, app/course version, and similar technical log information for
delivery, security, and debugging.

If you email us, we process your email address, message, attachments, and any
information you choose to provide so we can respond and keep an appropriate
support record. Please do not send sensitive information that is unnecessary
for your request.

## Information we do not collect

The App does not collect precise GPS location, contacts, photos, camera or
microphone content, health data, or public user-generated content. It does not
use advertising identifiers (IDFA/AAID), show third-party ads, or conduct
cross-app or cross-site advertising tracking. Session replay and automatic
capture of individual touches are disabled.

## Sources of information

We obtain information:

- directly from you when you answer onboarding questions, create an account,
  choose settings, make study selections, or contact us;
- automatically from the App and device when you use PermitCoach;
- from Apple or Google when you choose federated sign-in or make a store
  purchase; and
- from RevenueCat regarding subscription and entitlement status.

## How and why we use information

We use information to:

- operate the App, create and authenticate accounts, sync and restore progress,
  deliver course content, and remember settings;
- validate, provide, restore, and support PermitCoach Plus subscriptions;
- personalize the selected state course and study experience;
- understand onboarding and feature use, measure lesson and question
  difficulty, troubleshoot failures, and improve the App;
- process account, privacy, and support requests;
- protect the App, users, and our services from fraud, abuse, and security
  threats; and
- meet legal, tax, accounting, dispute-resolution, and store obligations.

Where the GDPR or UK GDPR applies, our legal bases are: performance of a
contract for the App, account, sync, and subscription services; our legitimate
interests in securing, supporting, and improving PermitCoach; compliance with
legal obligations; and consent where applicable law requires it, including for
non-essential analytics or notifications in some jurisdictions. Where consent
is the legal basis, you may withdraw it without affecting earlier lawful
processing. The current App does not include a general analytics opt-out; you
may request analytics deletion as described below.

## How we disclose information

We disclose information only as needed for the purposes described above:

| Recipient                             | Purpose and data                                                                                              | Processing location                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Supabase                              | Authentication, account database, and progress sync                                                           | United States                                                            |
| PostHog Inc.                          | Product analytics, person profiles, and analytics deletion                                                    | United States                                                            |
| RevenueCat Inc.                       | Subscription validation, entitlements, purchase history, and restoration                                      | United States and other locations described in its data-processing terms |
| Railway and network/hosting providers | Course/API delivery, server operation, and technical logs                                                     | United States                                                            |
| Apple and Google                      | App distribution, optional sign-in, store billing, refunds, and subscription management under their own terms | According to the provider and your store region                          |

Apple and Google may act as independent businesses/controllers for their own
store, billing, and sign-in activities. Our processors may use subprocessors
under their contracts with us.

We may also disclose information when reasonably necessary to comply with law
or legal process; protect rights, safety, and security; investigate fraud or
abuse; obtain professional advice; or complete a merger, financing,
reorganization, or transfer of the App, subject to appropriate safeguards and
notice where required.

## No sale, advertising sharing, or targeted advertising

We do not sell personal information for money. We do not share personal
information for cross-context behavioral advertising as "share" is defined by
the California Consumer Privacy Act (CCPA), and we do not process personal
information for targeted advertising as that term is used in applicable U.S.
state privacy laws. We do not knowingly sell or share the personal information
of users under 16.

## Retention

We retain information for the following periods or according to these
criteria:

- **Supabase account and synced study data:** until the account is deleted,
  unless retention is required for security, legal compliance, or dispute
  resolution.
- **Unused anonymous Supabase accounts:** a nightly job deletes free anonymous
  accounts after at least 30 days of inactivity when they have no lesson,
  topic, question, exam, streak, saved-item, or mistake progress. It does not
  delete an account whose synced plan is Plus. The same transaction queues the
  associated PostHog and RevenueCat identifiers for deletion.
- **PostHog analytics:** currently retained for up to one year under our
  PostHog plan, unless deleted earlier through an account/privacy request. If
  we extend this period, we will update this Policy. A provider deletion
  operation may be queued and take time to complete.
- **Subscription and transaction information:** for as long as needed to
  validate and administer the subscription and meet store, tax, accounting,
  fraud-prevention, and legal obligations. Apple, Google, and RevenueCat apply
  their own retention rules. Deleting a PermitCoach account does not delete
  your Apple or Google store account or transaction records.
- **Technical logs:** typically retained for up to 30 days. A provider may
  retain limited security, audit, or transaction logs longer under its
  documented retention schedule or where reasonably necessary for a security
  incident, fraud investigation, or legal obligation.
- **Support communications:** while we handle the request and for a reasonable
  recordkeeping period afterward, considering the nature of the request and
  applicable law.
- **Local data:** normally remains until cleared by the App, deleted by you, or
  removed when you uninstall the App. On iOS, the Supabase session stored in
  Keychain may survive uninstall and reinstall. Logging out or deleting the
  account clears the active session. Some inaccessible cached records may
  remain locally until the App is uninstalled or the operating system removes
  them.
- **Backups:** deleted information may remain temporarily in encrypted or
  access-controlled backups until the backup is overwritten under the relevant
  provider's schedule. We do not use backup copies for ordinary business
  purposes.

We may retain de-identified or aggregated information that cannot reasonably
be linked back to you.

## Account deletion and other controls

**Registered accounts.** In the App, go to **You → Delete account**. This
deletes the Supabase account and synced study data and atomically creates a
server-side job to delete the associated PostHog person, events, and any
recordings, and the associated RevenueCat customer. Provider deletion may be
asynchronous and is retried after temporary failures. The deletion job retains
the pseudonymous user identifier only while needed to complete those deletions
and is removed after both providers accept them. Apple and Google retain store
and transaction records under their own rules.

**Anonymous use.** If the deletion control is not shown, contact
support@permitcoach.app. Because an anonymous account has no email identity, we
may need to verify control of the active App session before acting on the
request.

**Subscriptions.** Account deletion, logout, and App uninstallation do not
cancel an auto-renewing subscription. Manage or cancel it separately through
the Apple App Store or Google Play account used to purchase it.

**Notifications.** You can change notification permission in your device
settings. The App does not operate a remote push-notification service.

## Your privacy rights

Depending on where you live and subject to legal exceptions, you may have the
right to request access to, correction of, deletion of, or a portable copy of
personal information; to object to or restrict certain processing; to withdraw
consent; and to appeal a refusal of a privacy request. You may also have the
right not to receive discriminatory treatment for exercising a privacy right.

Send a request to **support@permitcoach.app**. Describe the right you want to
exercise. We may ask for information reasonably necessary to verify your
identity, account, or authority to act for another person. We will respond
within the period required by the law that applies to the request. We may deny
or limit a request where an exception applies and will explain that decision
when required.

### California and other U.S. states

If the CCPA or another comprehensive U.S. state privacy law applies to us, the
categories collected in the preceding 12 months are described above and can
include identifiers, commercial/subscription information, internet or other
electronic activity, and preferences or inferences drawn from onboarding and
study activity. We disclose these categories to the service providers listed
above for business purposes. We do not sell them or share them for
cross-context behavioral advertising.

California residents may have rights to know/access, delete, correct, opt out
of sale or sharing, limit certain uses of sensitive personal information, and
receive non-discriminatory treatment. Because we do not sell or share data for
advertising, there is no sale or advertising sharing to opt out of. Account
credentials are used only to provide and secure the account, as permitted by
law.

### EEA, United Kingdom, and Switzerland

Where applicable, you may also lodge a complaint with your local data
protection authority. You may contact us first, but you are not required to do
so. Information about international transfers appears below.

## Children and teenagers

PermitCoach is intended for people aged **13 or older**, including teenagers
preparing for a learner's-permit test. It is not directed to children under 13,
and children under 13 may not use the App. We do not knowingly collect personal
information from a child under 13. Onboarding may ask for an age range, but it
does not request an exact birth date.

If we learn that we collected personal information from a child under 13
without legally valid parental consent, we will delete it. A parent or guardian
can contact **support@permitcoach.app**. Users under 18 should review this
Policy and the Terms of Use with a parent or legal guardian.

## Security

We use safeguards designed to protect information, including TLS in transit,
per-user database access controls, platform-protected session storage, access
controls for service credentials, and authentication-provider password
protections. No security measure is perfect, and we cannot guarantee absolute
security.

## International data transfers

Information may be accessed from or processed in the United States and in other
countries where we or our providers operate. Those countries may have
data-protection laws that differ from the laws where you live. Where a
restricted international transfer is subject to the GDPR or UK GDPR, we use an
applicable legal mechanism, such as an adequacy decision, the European
Commission's Standard Contractual Clauses, or the UK International Data
Transfer Addendum, together with supplementary safeguards where required.

## External links

The App links to official agency websites and other external services. Opening
a link is recorded in PermitCoach analytics by a general target label, and the
external service then processes information under its own privacy policy. An
official-agency link does not mean that the agency sponsors, approves, or is
affiliated with PermitCoach.

## Changes to this Policy

We may update this Policy as the App, providers, or law changes. We will update
the effective date and, when required, provide additional notice in the App or
request consent. Material changes apply prospectively unless law permits
otherwise.

## Contact

For privacy questions or requests, email **support@permitcoach.app**.

Palamarchuk Arsen (Паламарчук Арсен Вікторович), an individual
entrepreneur registered in Ukraine, is the data controller and operator of
PermitCoach.
