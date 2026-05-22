import Header from "@/components/Header";
import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | Songbook",
  description: "Privacy Policy for the Songbook Musical Notation Platform.",
};

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1
          className="text-3xl font-bold text-[var(--text-primary)] mb-8"
          style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
        >
          Privacy Policy
        </h1>

        <div className="prose prose-neutral max-w-none space-y-6 text-[var(--text-secondary)]">
          <p className="text-sm text-[var(--text-muted)]">
            Last updated: May 22, 2026
          </p>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mt-8 mb-3">
              Introduction
            </h2>
            <p>
              Songbook (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) operates the website{" "}
              <Link href="/" className="text-[var(--accent-primary)] underline">
                songnotations.vercel.app
              </Link>
              . This page informs you of our policies regarding the collection,
              use, and disclosure of personal information when you use our
              Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mt-8 mb-3">
              Information We Collect
            </h2>
            <p>
              We do not directly collect personal information from users. However,
              we use third-party services that may collect information used to
              identify you:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                <strong>Google AdSense</strong> — We use Google AdSense to display
                advertisements. Google may use cookies and web beacons to serve ads
                based on your prior visits to this or other websites. You may opt
                out of personalized advertising by visiting{" "}
                <a
                  href="https://www.google.com/settings/ads"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent-primary)] underline"
                >
                  Google Ads Settings
                </a>
                .
              </li>
              <li>
                <strong>Vercel Analytics</strong> — We may use Vercel&apos;s
                built-in analytics to understand page performance. This data is
                aggregated and does not personally identify you.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mt-8 mb-3">
              Cookies
            </h2>
            <p>
              Cookies are small text files stored on your device. We do not set
              first-party cookies. Third-party services (like Google AdSense) may
              set cookies to serve relevant ads. You can instruct your browser to
              refuse all cookies or indicate when a cookie is being sent.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mt-8 mb-3">
              Third-Party Links
            </h2>
            <p>
              Our Service may contain links to third-party websites. We have no
              control over and assume no responsibility for the content, privacy
              policies, or practices of any third-party sites or services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mt-8 mb-3">
              Children&apos;s Privacy
            </h2>
            <p>
              Our Service does not address anyone under the age of 13. We do not
              knowingly collect personal information from children under 13.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mt-8 mb-3">
              Changes to This Policy
            </h2>
            <p>
              We may update our Privacy Policy from time to time. We will notify
              you of any changes by posting the new Privacy Policy on this page
              and updating the &quot;Last updated&quot; date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mt-8 mb-3">
              Contact Us
            </h2>
            <p>
              If you have any questions about this Privacy Policy, please contact
              us via our{" "}
              <a
                href="https://github.com/contactmrshalin/songbook"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent-primary)] underline"
              >
                GitHub repository
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
