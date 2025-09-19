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

  // Get your access key from https://web3forms.com
  const WEB3FORMS_ACCESS_KEY = "f2269be6-3654-4154-b3f6-6f8d266993ae"; // <-- REPLACE THIS WITH YOUR KEY

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
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          access_key: WEB3FORMS_ACCESS_KEY,
          name: formData.name,
          email: formData.email,
          message: formData.message,
          subject: `New Contact Form Message from ${formData.name}`,
        }),
      });

      const result = await response.json();

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

  return (
    <section
      id="contact"
      className="w-full min-h-screen flex items-center justify-center py-20 px-4 bg-rose-50"
    >
      <div className="w-full max-w-xl sm:max-w-2xl lg:max-w-3xl mx-auto bg-white rounded-lg shadow-xl p-6 md:p-10 border border-rose-100">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-12 bg-gradient-to-r from-orange-400 to-rose-500 bg-clip-text text-transparent text-center">
          Contact Us
        </h2>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="name" className="sr-only">
              Name
            </label>
            <input
              id="name"
              className="w-full bg-rose-50 border border-rose-200 rounded-lg px-4 py-4 sm:py-5 text-gray-800 text-base sm:text-lg transition focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400 placeholder-gray-500"
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

          <div>
            <label htmlFor="email" className="sr-only">
              Email
            </label>
            <input
              id="email"
              className="w-full bg-rose-50 border border-rose-200 rounded-lg px-4 py-4 sm:py-5 text-gray-800 text-base sm:text-lg transition focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400 placeholder-gray-500"
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

          <div>
            <label htmlFor="message" className="sr-only">
              Message
            </label>
            <textarea
              id="message"
              className="w-full bg-rose-50 border border-rose-200 rounded-lg px-4 py-4 sm:py-5 text-gray-800 text-base sm:text-lg transition focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400 placeholder-gray-500 resize-none"
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

          <button
            type="submit"
            disabled={
              isSubmitting ||
              !formData.name.trim() ||
              !formData.email.trim() ||
              !formData.message.trim()
            }
            className="w-full bg-orange-500 text-white py-4 sm:py-5 px-6 text-lg rounded-lg font-medium transition-all duration-300 relative overflow-hidden group hover:shadow-lg hover:shadow-orange-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
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
            <div className="text-center p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-700 font-medium">
              ✅ Message sent successfully! I will get back to you soon.
            </div>
          )}
          {submitStatus === "error" && (
            <div className="text-center p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-700 font-medium">
              ❌ Oops! Something went wrong. Please try again later.
            </div>
          )}
        </form>
      </div>
    </section>
  );
};

export default Contact;
