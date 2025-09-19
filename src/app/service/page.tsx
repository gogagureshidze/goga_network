import React from "react";

const TermsOfServicePage = () => {
  return (
    // Main container with a soft rose background, consistent with Privacy Policy
    <main className="w-full min-h-screen bg-rose-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-xl p-6 md:p-10 border border-rose-100">
        <article className="prose prose-lg max-w-none text-gray-800">
          {/* Header with gradient and prominent styling */}
          <header className="mb-10 text-center">
            <h1 className="text-5xl font-extrabold bg-gradient-to-r from-orange-400 to-rose-500 text-transparent bg-clip-text mb-4">
              Terms of Service
            </h1>
            <p className="text-lg text-gray-600 font-medium">
              Effective Date: 2025, 1 October
            </p>
          </header>

          {/* Section 1: Introduction and Agreement */}
          <section className="mb-10 p-6 rounded-lg bg-orange-50/50 border border-orange-100">
            <h2 className="text-3xl font-bold text-orange-600 mb-4 border-b-2 border-orange-300 pb-2">
              1. Introduction and Agreement
            </h2>
            <p className="leading-relaxed text-gray-700">
              Welcome to{" "}
              <strong className="text-orange-500">goga.network</strong>{" "}
              . These Terms of Service (&quot;Terms&quot;)
              govern your use of our website, mobile application, and related
              services (collectively, the &quot;Services&quot;).
            </p>
            <p className="leading-relaxed text-gray-700 mt-3">
              By accessing or using our Services, you agree to be bound by these
              Terms. If you do not agree to these Terms, you may not use our
              Services. You must be at least 13 years old to use the Services.
            </p>
          </section>

          {/* Section 2: User Accounts */}
          <section className="mb-10 p-6 rounded-lg bg-rose-100/50 border border-rose-200">
            <h2 className="text-3xl font-bold text-rose-600 mb-4 border-b-2 border-rose-300 pb-2">
              2. User Accounts
            </h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>
                <strong>Account Creation:</strong> To use most features of the
                Services, you must create an account. You agree to provide
                accurate and complete information and to keep this information
                up-to-date.
              </li>
              <li>
                <strong>Account Security:</strong> You are responsible for
                safeguarding your password and for any activities or actions
                under your account. You agree to notify us immediately of any
                unauthorized use of your account. We are not liable for any loss
                or damage arising from your failure to comply with this security
                obligation.
              </li>
            </ul>
          </section>

          {/* Section 3: Your Content */}
          <section className="mb-10 p-6 rounded-lg bg-orange-50/50 border border-orange-100">
            <h2 className="text-3xl font-bold text-orange-600 mb-4 border-b-2 border-orange-300 pb-2">
              3. Your Content
            </h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>
                <strong>Content Responsibility:</strong> You are solely
                responsible for all content you post, upload, or otherwise make
                available on the Services (&quot;Your Content&quot;).
              </li>
              <li>
                <strong>Content License:</strong> By posting Your Content, you
                grant Goga a non-exclusive, royalty-free, worldwide,
                transferable, and sublicensable license to use, reproduce,
                modify, adapt, publish, create derivative works from,
                distribute, and display Your Content in connection with the
                Services and our business, including for promoting the Services.
                This license ends when you delete Your Content or your account.
              </li>
              <li>
                <strong>Content Standards:</strong> You agree not to post any
                content that is illegal, defamatory, obscene, harassing,
                hateful, or otherwise violates the rights of others. We reserve
                the right, but are not obligated, to remove any content that
                violates these Terms.
              </li>
            </ul>
          </section>

          {/* Section 4: Acceptable Use */}
          <section className="mb-10 p-6 rounded-lg bg-rose-100/50 border border-rose-200">
            <h2 className="text-3xl font-bold text-rose-600 mb-4 border-b-2 border-rose-300 pb-2">
              4. Acceptable Use
            </h2>
            <p className="leading-relaxed text-gray-700">
              You agree not to use the Services for any of the following
              purposes:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>
                To engage in any illegal activities or to violate any laws.
              </li>
              <li>To harass, stalk, or otherwise harm another user.</li>
              <li>To post spam, scams, or other malicious content.</li>
              <li>To interfere with the proper functioning of the Services.</li>
              <li>
                To attempt to gain unauthorized access to our systems or other
                users accounts.
              </li>
            </ul>
          </section>

          {/* Section 5: Intellectual Property */}
          <section className="mb-10 p-6 rounded-lg bg-orange-50/50 border border-orange-100">
            <h2 className="text-3xl font-bold text-orange-600 mb-4 border-b-2 border-orange-300 pb-2">
              5. Intellectual Property
            </h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>
                <strong>Our Rights:</strong> All intellectual property rights in
                the Services (excluding Your Content), including trademarks,
                logos, and software, are owned by Goga. You may not use these
                without our prior written permission.
              </li>
              <li>
                <strong>Copyright:</strong> If you believe that your copyright
                has been infringed by any content on our Services, please
                contact us at{" "}
                <a
                  href="mailto:gogagureshidze8@gmail.com"
                  className="text-orange-600 hover:text-orange-800 hover:underline font-medium"
                >
                  gogagureshidze8@gmail.com
                </a>
                .
              </li>
            </ul>
          </section>

          {/* Section 6: Disclaimer of Warranties */}
          <section className="mb-10 p-6 rounded-lg bg-rose-100/50 border border-rose-200">
            <h2 className="text-3xl font-bold text-rose-600 mb-4 border-b-2 border-rose-300 pb-2">
              6. Disclaimer of Warranties
            </h2>
            <p className="leading-relaxed text-gray-700">
              The Services are provided on an &quot;as is&quot; and &quot;as
              available&quot; basis. We disclaim all warranties of any kind,
              whether express or implied, including, but not limited to, the
              implied warranties of merchantability, fitness for a particular
              purpose, and non-infringement. We do not guarantee that the
              Services will be uninterrupted, secure, or error-free.
            </p>
          </section>

          {/* Section 7: Limitation of Liability */}
          <section className="mb-10 p-6 rounded-lg bg-orange-50/50 border border-orange-100">
            <h2 className="text-3xl font-bold text-orange-600 mb-4 border-b-2 border-orange-300 pb-2">
              7. Limitation of Liability
            </h2>
            <p className="leading-relaxed text-gray-700">
              To the fullest extent permitted by law, Goga shall not be liable
              for any indirect, incidental, special, consequential, or punitive
              damages, or any loss of profits or revenues, whether incurred
              directly or indirectly, or any loss of data, use, goodwill, or
              other intangible losses, resulting from (a) your access to or use
              of the Services; (b) any conduct or content of any third party on
              the Services; or (c) unauthorized access, use, or alteration of
              Your Content.
            </p>
          </section>

          {/* Section 8: Changes to the Terms */}
          <section className="mb-10 p-6 rounded-lg bg-rose-100/50 border border-rose-200">
            <h2 className="text-3xl font-bold text-rose-600 mb-4 border-b-2 border-rose-300 pb-2">
              8. Changes to the Terms
            </h2>
            <p className="leading-relaxed text-gray-700">
              We may update these Terms from time to time. If we make material
              changes, we will notify you by posting a new version on our
              website. Your continued use of the Services after the effective
              date of the revised Terms constitutes your acceptance of the
              changes.
            </p>
          </section>

          {/* Section 9: Contact Information */}
          <section className="p-6 rounded-lg bg-orange-50/50 border border-orange-100">
            <h2 className="text-3xl font-bold text-orange-600 mb-4 border-b-2 border-orange-300 pb-2">
              9. Contact Information
            </h2>
            <p className="leading-relaxed text-gray-700">
              If you have any questions about these Terms, please contact us at:
            </p>
            <p className="mt-3">
              <a
                href="mailto:gogagureshidze8@gmail.com"
                className="text-orange-600 hover:text-orange-800 hover:underline text-lg font-medium"
              >
                gogagureshidze8@gmail.com
              </a>
            </p>
          </section>
        </article>
      </div>
    </main>
  );
};

export default TermsOfServicePage;
