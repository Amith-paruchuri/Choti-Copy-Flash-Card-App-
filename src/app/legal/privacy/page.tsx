import type { Metadata } from "next";

import { LegalDoc, LegalSection } from "@/components/legal-doc";
import { SUPPORT_EMAIL, supportMailto } from "@/lib/contact";
import { TERMS_VERSION } from "@/lib/env";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy Policy"
      updated={TERMS_VERSION}
      intro="An early draft, generated from a standard template and pending legal review before public launch. It explains what data Choti Copy collects, why, who it's shared with, and the choices you have."
    >
      <LegalSection heading="What we collect">
        <ul>
          <li>
            <strong>Account data</strong> — your email address, and a display
            name if you set one. Passwords are handled by our authentication
            provider (Supabase) and we never see them in plain text.
          </li>
          <li>
            <strong>Content you create</strong> — flashcards, subjects, notes,
            and any images or files you upload, plus your review ratings, quiz
            answers, and the scheduling state derived from them.
          </li>
          <li>
            <strong>Basic technical data</strong> — standard server logs (IP
            address, timestamps, error traces) needed to run and secure the
            Service.
          </li>
        </ul>
        <p>
          We do not use third-party advertising or analytics trackers, and we do
          not sell your data.
        </p>
      </LegalSection>

      <LegalSection heading="Why we use it">
        <p>
          To provide the Service: store and display your cards, schedule
          reviews, generate quizzes, and keep your account secure. Our legal
          basis is performance of the contract with you (these Terms) and our
          legitimate interest in operating a reliable service.
        </p>
      </LegalSection>

      <LegalSection heading="Who it's shared with">
        <ul>
          <li>
            <strong>Supabase</strong> — our database, authentication, and file
            storage provider. Your account and content are stored there.
          </li>
          <li>
            <strong>Google (Gemini) and xAI (Grok)</strong> — when you use an AI
            feature, the relevant text (and, for image imports, the images) is
            sent to one of these providers to produce the result. This only
            happens when you trigger the feature. Their handling of that data is
            governed by their own policies.
          </li>
          <li>
            <strong>Hosting / infrastructure providers</strong> that run the
            application servers.
          </li>
          <li>
            When paid plans launch, a <strong>payment processor</strong> (Stripe
            or Razorpay) will handle billing details. We will not store full card
            numbers ourselves.
          </li>
        </ul>
        <p>
          We may also disclose data if required by law or to protect the rights
          and safety of users.
        </p>
      </LegalSection>

      <LegalSection heading="Retention">
        <p>
          We keep your content for as long as your account is active. Server
          logs are kept for a limited period and then rotated out.
        </p>
      </LegalSection>

      <LegalSection heading="Your rights">
        <ul>
          <li>
            <strong>Export</strong> — download everything in your account as a
            JSON file at any time, from Profile → Your data.
          </li>
          <li>
            <strong>Correction</strong> — edit your name, email, and any of your
            content directly in the app.
          </li>
          <li>
            <strong>Deletion</strong> — you can request full deletion of your
            account and its data. Deleting your account removes your subjects,
            flashcards, review history, and quiz data; backups are purged on
            their normal cycle. (A self-serve delete button is on the way; until
            then, email{" "}
            <a href={supportMailto("Delete my Choti Copy account")}>
              {SUPPORT_EMAIL}
            </a>{" "}
            and we will action it.)
          </li>
        </ul>
        <p>
          Depending on where you live you may also have rights to object to or
          restrict processing, or to lodge a complaint with a data protection
          authority.
        </p>
      </LegalSection>

      <LegalSection heading="Security">
        <p>
          Every table is protected by row-level security keyed to your user ID,
          so one account cannot read another&rsquo;s data. Traffic is encrypted
          in transit. No system is perfectly secure, but we aim to follow
          sensible practice.
        </p>
      </LegalSection>

      <LegalSection heading="Children">
        <p>
          The Service is not intended for children under 16. We do not knowingly
          collect data from them.
        </p>
      </LegalSection>

      <LegalSection heading="Changes and contact">
        <p>
          We will post updates here and, for material changes, ask you to
          re-accept at sign-in. For privacy questions or a deletion request,
          email{" "}
          <a href={supportMailto("Privacy request")}>{SUPPORT_EMAIL}</a>.
        </p>
      </LegalSection>
    </LegalDoc>
  );
}
