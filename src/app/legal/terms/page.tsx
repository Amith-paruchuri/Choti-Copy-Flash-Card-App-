import type { Metadata } from "next";

import { LegalDoc, LegalSection } from "@/components/legal-doc";
import { SUPPORT_EMAIL, supportMailto } from "@/lib/contact";
import { TERMS_VERSION } from "@/lib/env";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalDoc
      title="Terms of Service"
      updated={TERMS_VERSION}
      intro="This is an early draft, generated from a standard template and pending review by a lawyer before public launch. It describes how Choti Copy works and the rules for using it. If anything here conflicts with applicable law, the law wins."
    >
      <LegalSection heading="1. The service">
        <p>
          Choti Copy (&ldquo;the Service&rdquo;) is a study tool that lets you
          store flashcards, organise them into subjects, review them on a
          spaced-repetition schedule, and generate practice quizzes. It is
          provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo;
          basis. We may change, suspend, or discontinue any part of it at any
          time.
        </p>
      </LegalSection>

      <LegalSection heading="2. Your account">
        <p>
          You need an account to use the Service. You are responsible for
          keeping your login credentials secure and for everything that happens
          under your account. You must be old enough to form a binding contract
          in your jurisdiction (at least 16, or older where local law requires).
        </p>
      </LegalSection>

      <LegalSection heading="3. Content you upload">
        <p>
          You keep ownership of the notes, flashcards, images, files, and other
          material you add (&ldquo;Your Content&rdquo;). By uploading it you grant
          us a limited licence to store, process, and display it back to you so
          the Service can function, and to send relevant parts of it to the
          third-party AI providers described in section 4.
        </p>
        <p>You are responsible for Your Content. In particular, you agree that:</p>
        <ul>
          <li>
            you have the rights to upload it — you will not upload copyrighted
            textbooks, question banks, exam papers, or other material you do not
            have permission to use;
          </li>
          <li>
            it does not contain anything unlawful, and does not include other
            people&rsquo;s personal or confidential information without a lawful
            basis;
          </li>
          <li>
            you will not use the Service to build a competing product or to
            resell AI-generated output at scale.
          </li>
        </ul>
        <p>
          We may remove content or suspend accounts that breach these rules. We
          do not routinely monitor Your Content.
        </p>
      </LegalSection>

      <LegalSection heading="4. AI processing">
        <p>
          Some features send Your Content to third-party AI providers —
          currently Google (Gemini) and xAI (Grok) — to condense notes into
          flashcards, suggest how to organise them, and write quiz questions.
          That text (and, for image imports, the images) leaves our systems and
          is processed under those providers&rsquo; terms. We only send what a
          feature needs, and only when you trigger it. If you are not
          comfortable with this, do not use the AI features.
        </p>
      </LegalSection>

      <LegalSection heading="5. Subscriptions and free trial (placeholder)">
        <p>
          The Service currently has a single free tier with no usage limits.
          Paid plans are not yet available. When they launch, this section will
          set out pricing, billing cycle, any free-trial length, renewal, and
          cancellation terms, and payment will be handled by a third-party
          processor (Stripe or Razorpay). Nothing in this draft obliges you to
          pay anything.
        </p>
      </LegalSection>

      <LegalSection heading="6. Acceptable use">
        <p>
          Do not attempt to break, overload, reverse-engineer, or gain
          unauthorised access to the Service or other users&rsquo; data; do not
          use it to generate content that is illegal, harmful, or infringing.
        </p>
      </LegalSection>

      <LegalSection heading="7. Disclaimers and liability">
        <p>
          AI-generated flashcards and quiz questions can be wrong or incomplete.
          Do not rely on them as your only source, especially for medical,
          legal, or safety-critical study. To the maximum extent permitted by
          law, we are not liable for indirect or consequential losses, and our
          total liability is limited to the amount you have paid us in the
          previous 12 months (currently zero).
        </p>
      </LegalSection>

      <LegalSection heading="8. Termination">
        <p>
          You can stop using the Service and delete your account at any time
          (see the Privacy Policy for how). We may terminate or suspend your
          access if you materially breach these terms.
        </p>
      </LegalSection>

      <LegalSection heading="9. Changes">
        <p>
          We may update these terms. If we make a material change we will ask
          you to accept the new version the next time you sign in. Continued use
          after that means you accept the change.
        </p>
      </LegalSection>

      <LegalSection heading="10. Contact">
        <p>
          Questions about these terms: email{" "}
          <a href={supportMailto("Question about the Terms")}>
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>
    </LegalDoc>
  );
}
