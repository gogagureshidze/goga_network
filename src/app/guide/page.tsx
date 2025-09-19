import React from "react";

const CommunityGuidelinesPage = () => {
  return (
    // Main container with a soft rose background, consistent with other pages
    <main className="w-full min-h-screen bg-rose-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-xl p-6 md:p-10 border border-rose-100">
        <article className="prose prose-lg max-w-none text-gray-800">
          {/* Header with gradient and prominent styling */}
          <header className="mb-10 text-center">
            <h1 className="text-5xl font-extrabold bg-gradient-to-r from-orange-400 to-rose-500 text-transparent bg-clip-text mb-4">
              Community Guidelines
            </h1>
            <p className="text-lg text-gray-600 font-medium">
              Effective Date: 2025, 1 October
            </p>
          </header>

          {/* Section 1: Introduction */}
          <section className="mb-10 p-6 rounded-lg bg-orange-50/50 border border-orange-100">
            <h2 className="text-3xl font-bold text-orange-600 mb-4 border-b-2 border-orange-300 pb-2">
              1. Introduction and Our Commitment
            </h2>
            <p className="leading-relaxed text-gray-700">
              Welcome to the{" "}
              <strong className="text-orange-500">goga.network</strong>{" "}
              community! Our goal is to create a positive, safe, and welcoming
              space for everyone. These Community Guidelines are the rules of
              the road for our platform. By using goga.network, you agree to
              follow them. We reserve the right to remove content or suspend
              accounts that violate these guidelines.
            </p>
          </section>

          {/* Section 2: Be Kind and Respectful */}
          <section className="mb-10 p-6 rounded-lg bg-rose-100/50 border border-rose-200">
            <h2 className="text-3xl font-bold text-rose-600 mb-4 border-b-2 border-rose-300 pb-2">
              2. Be Kind and Respectful
            </h2>
            <p className="leading-relaxed text-gray-700">
              Treat others as you want to be treated.
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>
                <strong>No Hate Speech:</strong> Do not post content that
                promotes discrimination, disparages, or incites hatred against
                individuals or groups based on race, ethnicity, religion,
                gender, sexual orientation, disability, or any other protected
                characteristic.
              </li>
              <li>
                <strong>No Harassment or Bullying:</strong> Do not bully,
                threaten, or harass other users. This includes sending repeated,
                unwanted messages or making personal attacks.
              </li>
              <li>
                <strong>Respect Privacy:</strong> Do not share other
                people&apos;s private information without their explicit
                consent. This includes phone numbers, home addresses, or private
                photos.
              </li>
            </ul>
          </section>

          {/* Section 3: Keep It Clean and Safe */}
          <section className="mb-10 p-6 rounded-lg bg-orange-50/50 border border-orange-100">
            <h2 className="text-3xl font-bold text-orange-600 mb-4 border-b-2 border-orange-300 pb-2">
              3. Keep It Clean and Safe
            </h2>
            <p className="leading-relaxed text-gray-700">
              Our community is not a place for illegal or harmful content.
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>
                <strong>No Illegal Content:</strong> Do not post or promote
                illegal acts, goods, or services.
              </li>
              <li>
                <strong>No Nudity or Sexually Explicit Content:</strong> Do not
                post sexually explicit material. This includes pornography,
                sexual acts, or graphic content.
              </li>
              <li>
                <strong>No Graphic or Violent Content:</strong> Do not post
                content that depicts gratuitous violence, gore, or extreme
                cruelty.
              </li>
            </ul>
          </section>

          {/* Section 4: Be Yourself */}
          <section className="mb-10 p-6 rounded-lg bg-rose-100/50 border border-rose-200">
            <h2 className="text-3xl font-bold text-rose-600 mb-4 border-b-2 border-rose-300 pb-2">
              4. Be Yourself
            </h2>
            <p className="leading-relaxed text-gray-700">
              Authenticity is important to us.
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>
                <strong>No Impersonation:</strong> Do not create accounts or
                post content that misrepresents your identity or impersonates
                another person or entity.
              </li>
              <li>
                <strong>No Spam or Scams:</strong> Do not post spam, phishing
                scams, or other deceptive content. This includes uninvited
                commercial messages.
              </li>
            </ul>
          </section>

          {/* Section 5: Respect Intellectual Property */}
          <section className="mb-10 p-6 rounded-lg bg-orange-50/50 border border-orange-100">
            <h2 className="text-3xl font-bold text-orange-600 mb-4 border-b-2 border-orange-300 pb-2">
              5. Respect Intellectual Property
            </h2>
            <p className="leading-relaxed text-gray-700">
              You should only post content that you have the rights to. Do not
              post content that infringes on someone else&apos;s copyright,
              trademark, or other intellectual property rights.
            </p>
          </section>

          {/* Section 6: Reporting Violations */}
          <section className="mb-10 p-6 rounded-lg bg-rose-100/50 border border-rose-200">
            <h2 className="text-3xl font-bold text-rose-600 mb-4 border-b-2 border-rose-300 pb-2">
              6. Reporting Violations
            </h2>
            <p className="leading-relaxed text-gray-700">
              If you see content or behavior that violates these guidelines,
              please report it to us. You can usually find a Report button on
              posts or user profiles. Our team will review all reports and take
              appropriate action.
            </p>
          </section>

          {/* Section 7: Enforcement */}
          <section className="p-6 rounded-lg bg-orange-50/50 border border-orange-100">
            <h2 className="text-3xl font-bold text-orange-600 mb-4 border-b-2 border-orange-300 pb-2">
              7. Enforcement
            </h2>
            <p className="leading-relaxed text-gray-700">
              When content or behavior violates our guidelines, we may take
              action, including:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>Removing the content.</li>
              <li>Issuing a warning.</li>
              <li>Temporarily or permanently suspending an account.</li>
            </ul>
            <p className="leading-relaxed text-gray-700 mt-3">
              We reserve the right to make a final decision on all enforcement
              actions, and we will do our best to be fair and consistent.
            </p>
          </section>
        </article>
      </div>
    </main>
  );
};

export default CommunityGuidelinesPage;
