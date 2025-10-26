"use client";

import React, { useState } from "react";
import { Loader2, Send, CheckCircle } from "lucide-react";

const Contact = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "success" | "error"
  >("idle");

  // This function now uses FormSubmit.co
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus("idle");

    if (
      !formData.name.trim() ||
      !formData.email.trim() ||
      !formData.message.trim()
    ) {
      setIsSubmitting(false);
      return;
    }

    try {
      // === 1. CHANGE THIS URL ===
      // Replace "gogagureshidze8@gmail.com" with your own email address.
      // We use the "/ajax/" prefix for a smooth JSON response.
      const response = await fetch(
        "https://formsubmit.co/ajax/gogagureshidze8@gmail.com",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          // === 2. UPDATE THE BODY ===
          // FormSubmit uses different field names (like _subject).
          // We removed the old "access_key".
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            message: formData.message,
            _subject: `New Contact Form Message from ${formData.name}`,
            _replyto: formData.email, // Allows you to reply directly to the user's email
            _template: "table", // Makes the email you receive look nicer
          }),
        }
      );

      const result = await response.json();

      // The success check is the same
      if (response.ok && result.success) {
        setSubmitStatus("success");
        setFormData({ name: "", email: "", message: "" });
        setTimeout(() => setSubmitStatus("idle"), 5000);
      } else {
        throw new Error(result.message || "Something went wrong.");
      }
    } catch (error) {
      console.error("Form submission error:", error);
      setSubmitStatus("error");
      setTimeout(() => setSubmitStatus("idle"), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  // The rest of your component (the JSX) is perfect and needs no changes!
  return (
    <section
      id="contact"
      className="w-full min-h-screen flex items-center justify-center py-20 px-4 bg-rose-50 dark:bg-gray-900 transition-colors duration-300"
    >
      <div className="w-full max-w-xl sm:max-w-2xl lg:max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 md:p-10 border border-rose-100 dark:border-gray-700 transition-colors duration-300">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-12 bg-gradient-to-r from-orange-400 to-rose-500 bg-clip-text text-transparent dark:bg-none dark:text-white text-center">
          Contact Us
        </h2>

        <form className="space-y-6" onSubmit={handleSubmit}>
          {/* Name Input */}
          <div>
            <label htmlFor="name" className="sr-only">
              Name
            </label>
            <input
              id="name"
              className="w-full bg-rose-50 dark:bg-gray-700 border border-rose-200 dark:border-gray-600 rounded-lg px-4 py-4 sm:py-5 text-gray-800 dark:text-white text-base sm:text-lg transition focus:outline-none focus:ring-2 focus:ring-orange-300 dark:focus:ring-gray-500 focus:border-orange-400 dark:focus:border-gray-500 placeholder-gray-500 dark:placeholder-gray-400"
              type="text"
              value={formData.name}
              required
              placeholder="Name"
              disabled={isSubmitting}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
          </div>

          {/* Email Input */}
          <div>
            <label htmlFor="email" className="sr-only">
              Email
            </label>
            <input
              id="email"
              className="w-full bg-rose-50 dark:bg-gray-700 border border-rose-200 dark:border-gray-600 rounded-lg px-4 py-4 sm:py-5 text-gray-800 dark:text-white text-base sm:text-lg transition focus:outline-none focus:ring-2 focus:ring-orange-300 dark:focus:ring-gray-500 focus:border-orange-400 dark:focus:border-gray-500 placeholder-gray-500 dark:placeholder-gray-400"
              type="email"
              value={formData.email}
              required
              disabled={isSubmitting}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              placeholder="Email"
            />
          </div>

          {/* Message Textarea */}
          <div>
            <label htmlFor="message" className="sr-only">
              Message
            </label>
            <textarea
              id="message"
              className="w-full bg-rose-50 dark:bg-gray-700 border border-rose-200 dark:border-gray-600 rounded-lg px-4 py-4 sm:py-5 text-gray-800 dark:text-white text-base sm:text-lg transition focus:outline-none focus:ring-2 focus:ring-orange-300 dark:focus:ring-gray-500 focus:border-orange-400 dark:focus:border-gray-500 placeholder-gray-500 dark:placeholder-gray-400 resize-none"
              value={formData.message}
              required
              disabled={isSubmitting}
              onChange={(e) =>
                setFormData({ ...formData, message: e.target.value })
              }
              rows={6}
              placeholder="Your Message"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={
              isSubmitting ||
              !formData.name.trim() ||
              !formData.email.trim() ||
              !formData.message.trim()
            }
            className="w-full bg-orange-500 dark:bg-gray-600 text-white dark:text-gray-200 py-4 sm:py-5 px-6 text-lg rounded-lg font-medium transition-all duration-300 relative overflow-hidden group hover:shadow-lg hover:shadow-orange-200 dark:hover:bg-gray-500 dark:hover:shadow-gray-900/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            <div className="flex items-center justify-center gap-2">
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin w-5 h-5" />
                  Sending...
                </>
              ) : submitStatus === "success" ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Sent!
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Send Message
                </>
              )}
            </div>
          </button>

          {/* Status Messages */}
          {submitStatus === "success" && (
            <div className="text-center p-4 rounded-lg bg-green-500/10 dark:bg-green-900/50 border border-green-500/20 dark:border-green-700 text-green-700 dark:text-green-300 font-medium">
              ✅ Message sent successfully! I will get back to you soon.
            </div>
          )}
          {submitStatus === "error" && (
            <div className="text-center p-4 rounded-lg bg-red-500/10 dark:bg-red-900/50 border border-red-500/20 dark:border-red-700 text-red-700 dark:text-red-300 font-medium">
              ❌ Oops! Something went wrong. Please try again later.
            </div>
          )}
        </form>
      </div>
    </section>
  );
};

export default Contact;
