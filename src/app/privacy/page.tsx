import React from "react";

const PrivacyPolicyPage = () => {
  return (
    // Main container with a soft rose background
    <main className="w-full min-h-screen bg-rose-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-xl p-6 md:p-10 border border-rose-100">
        <article className="prose prose-lg max-w-none text-gray-800">
          {/* Header with a gradient and larger text */}
          <header className="mb-10 text-center">
            <h1 className="text-5xl font-extrabold bg-gradient-to-r from-orange-400 to-rose-500 text-transparent bg-clip-text mb-4">
              Privacy Policy
            </h1>
            <p className="text-lg text-gray-600 font-medium">
              Effective Date: 2025, 1 October
            </p>
          </header>

          {/* Section 1: Introduction */}
          <section className="mb-10 p-6 rounded-lg bg-orange-50/50 border border-orange-100">
            <h2 className="text-3xl font-bold text-orange-600 mb-4 border-b-2 border-orange-300 pb-2">
              1. Introduction
            </h2>
            <p className="leading-relaxed text-gray-700">
              Welcome to{" "}
              <strong className="text-orange-500">goga.network</strong>. We are
              committed to protecting the privacy and security of your personal
              information. This Privacy Policy describes how we collect, use,
              and share information from and about you when you use our website,
              mobile application, and related services.
            </p>
            <p className="leading-relaxed text-gray-700 mt-3">
              By using our Services, you agree to the collection, use, and
              disclosure of your information as described in this Privacy
              Policy.
            </p>
          </section>

          {/* Section 2: Information We Collect */}
          <section className="mb-10 p-6 rounded-lg bg-rose-100/50 border border-rose-200">
            <h2 className="text-3xl font-bold text-rose-600 mb-4 border-b-2 border-rose-300 pb-2">
              2. Information We Collect
            </h2>
            <p className="leading-relaxed text-gray-700">
              We collect information to provide and improve our Services. The
              types of information we collect include:
            </p>
            <h3 className="text-2xl font-semibold mt-8 mb-3 text-rose-500">
              A. Information You Provide to Us:
            </h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>
                <strong>Account Information:</strong> When you create an
                account, we collect your name, username, email address, and
                password.
              </li>
              <li>
                <strong>Profile Information:</strong> You may choose to add
                additional information to your profile, such as a profile
                picture, biography, and links to other social media profiles.
              </li>
              <li>
                <strong>Content You Create:</strong> We collect the content you
                post, including photos, videos, text, comments, and any other
                information you share.
              </li>
              <li>
                <strong>Communications:</strong> We collect information from
                your communications with us, such as emails or support requests.
              </li>
            </ul>
            <h3 className="text-2xl font-semibold mt-8 mb-3 text-rose-500">
              B. Information We Collect Automatically:
            </h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>
                <strong>Usage Data:</strong> We collect information about your
                activity on our Services, such as the pages you view, the time
                and duration of your visit, and your interactions with other
                users.
              </li>
              <li>
                <strong>Device Information:</strong> We collect information
                about the device you use to access the Services, including the
                device type, operating system, unique device identifiers, and
                mobile network information.
              </li>
              <li>
                <strong>Location Information:</strong> With your permission, we
                may collect precise location data from your device.
              </li>
            </ul>
          </section>

          {/* Section 3: How We Use Your Information */}
          <section className="mb-10 p-6 rounded-lg bg-orange-50/50 border border-orange-100">
            <h2 className="text-3xl font-bold text-orange-600 mb-4 border-b-2 border-orange-300 pb-2">
              3. How We Use Your Information
            </h2>
            <p className="leading-relaxed text-gray-700">
              We use the information we collect for the following purposes:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>
                <strong>To Provide the Services:</strong> To create and manage
                your account, allow you to post content, and enable you to
                connect with other users.
              </li>
              <li>
                <strong>To Improve the Services:</strong> To understand how our
                users interact with the Services so we can improve features,
                performance, and user experience.
              </li>
              <li>
                <strong>To Personalize Your Experience:</strong> To tailor the
                content you see, including suggested connections and
                advertisements.
              </li>
              <li>
                <strong>To Communicate With You:</strong> To send you important
                updates, notifications, and marketing communications.
              </li>
              <li>
                <strong>For Security and Safety:</strong> To detect, prevent,
                and respond to fraud, abuse, and other malicious activities.
              </li>
              <li>
                <strong>To Enforce our Terms:</strong> To ensure compliance with
                our Terms of Service and other policies.
              </li>
            </ul>
          </section>

          {/* Section 4: How We Share Your Information */}
          <section className="mb-10 p-6 rounded-lg bg-rose-100/50 border border-rose-200">
            <h2 className="text-3xl font-bold text-rose-600 mb-4 border-b-2 border-rose-300 pb-2">
              4. How We Share Your Information
            </h2>
            <p className="leading-relaxed text-gray-700">
              We do not sell your personal information. We may share your
              information with the following parties:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>
                <strong>With Other Users:</strong> Your public profile
                information and content are visible to other users of the
                Services.
              </li>
              <li>
                <strong>With Service Providers:</strong> We may share your
                information with third-party vendors and service providers who
                help us operate our business, such as cloud hosting, analytics,
                and marketing services.
              </li>
              <li>
                <strong>For Legal Reasons:</strong> We may disclose your
                information if required by law, such as in response to a
                subpoena or court order, or to protect our rights or the safety
                of others.
              </li>
              <li>
                <strong>In a Business Transfer:</strong> If we are involved in a
                merger, acquisition, or sale of assets, your information may be
                transferred as part of that transaction.
              </li>
            </ul>
          </section>

          {/* Section 5: Your Choices and Rights */}
          <section className="mb-10 p-6 rounded-lg bg-orange-50/50 border border-orange-100">
            <h2 className="text-3xl font-bold text-orange-600 mb-4 border-b-2 border-orange-300 pb-2">
              5. Your Choices and Rights
            </h2>
            <p className="leading-relaxed text-gray-700">
              You have certain rights regarding your personal information:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>
                <strong>Access and Correction:</strong> You can access and
                update your profile information at any time through your account
                settings.
              </li>
              <li>
                <strong>Data Portability:</strong> You can request a copy of
                your personal data in a structured, commonly used, and
                machine-readable format.
              </li>
              <li>
                <strong>Deletion:</strong> You can request the deletion of your
                account and personal information.
              </li>
              <li>
                <strong>Marketing Communications:</strong> You can opt-out of
                receiving marketing emails from us by following the unsubscribe
                instructions in those emails.
              </li>
            </ul>
          </section>

          {/* Section 6: Data Security */}
          <section className="mb-10 p-6 rounded-lg bg-rose-100/50 border border-rose-200">
            <h2 className="text-3xl font-bold text-rose-600 mb-4 border-b-2 border-rose-300 pb-2">
              6. Data Security
            </h2>
            <p className="leading-relaxed text-gray-700">
              We use a combination of technical, administrative, and physical
              safeguards to protect your information from unauthorized access,
              use, or disclosure. However, no method of transmission over the
              internet is 100% secure, and we cannot guarantee absolute
              security.
            </p>
          </section>

          {/* Section 7: Changes to This Privacy Policy */}
          <section className="mb-10 p-6 rounded-lg bg-orange-50/50 border border-orange-100">
            <h2 className="text-3xl font-bold text-orange-600 mb-4 border-b-2 border-orange-300 pb-2">
              7. Changes to This Privacy Policy
            </h2>
            <p className="leading-relaxed text-gray-700">
              We may update this Privacy Policy from time to time. If we make
              material changes, we will notify you by posting a new policy on
              our website or through other means. Your continued use of the
              Services after the effective date of the revised policy
              constitutes your acceptance of the changes.
            </p>
          </section>

          {/* Section 8: Contact Us */}
          <section className="p-6 rounded-lg bg-rose-100/50 border border-rose-200">
            <h2 className="text-3xl font-bold text-rose-600 mb-4 border-b-2 border-rose-300 pb-2">
              8. Contact Us
            </h2>
            <p className="leading-relaxed text-gray-700">
              If you have any questions about this Privacy Policy, please
              contact us at:
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

export default PrivacyPolicyPage;
