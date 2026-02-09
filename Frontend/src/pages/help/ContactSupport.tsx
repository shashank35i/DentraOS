import React, { useState } from 'react';
import { MessageSquareIcon, MailIcon, PhoneIcon, ClockIcon, SendIcon, CheckCircleIcon } from 'lucide-react';
export const ContactSupport: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    priority: 'medium',
    category: '',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const {
      name,
      value
    } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Support request:', formData);
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setFormData({
        name: '',
        email: '',
        subject: '',
        priority: 'medium',
        category: '',
        message: ''
      });
    }, 3000);
  };
  return <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
          <MessageSquareIcon size={24} className="mr-2 text-blue-600 dark:text-blue-400" />
          Contact Support
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">
          Get help from our support team
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Form */}
        <div className="lg:col-span-2">
          {submitted ? <div className="bg-white dark:bg-slate-800 rounded-xl shadow-soft p-8 text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-300 mx-auto mb-4">
                <CheckCircleIcon size={32} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Message Sent!
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                We've received your message and will get back to you within 24
                hours.
              </p>
            </div> : <div className="bg-white dark:bg-slate-800 rounded-xl shadow-soft p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                Send us a message
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className="label">
                      Your Name
                    </label>
                    <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} className="input" required />
                  </div>
                  <div>
                    <label htmlFor="email" className="label">
                      Email Address
                    </label>
                    <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} className="input" required />
                  </div>
                </div>
                <div>
                  <label htmlFor="subject" className="label">
                    Subject
                  </label>
                  <input type="text" id="subject" name="subject" value={formData.subject} onChange={handleChange} className="input" required />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="category" className="label">
                      Category
                    </label>
                    <select id="category" name="category" value={formData.category} onChange={handleChange} className="input" required>
                      <option value="">Select a category</option>
                      <option value="technical">Technical Issue</option>
                      <option value="billing">Billing Question</option>
                      <option value="feature">Feature Request</option>
                      <option value="account">Account Management</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="priority" className="label">
                      Priority
                    </label>
                    <select id="priority" name="priority" value={formData.priority} onChange={handleChange} className="input">
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label htmlFor="message" className="label">
                    Message
                  </label>
                  <textarea id="message" name="message" value={formData.message} onChange={handleChange} className="input h-32" required></textarea>
                </div>
                <button type="submit" className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition-colors shadow-sm flex items-center justify-center">
                  <SendIcon size={18} className="mr-2" />
                  Send Message
                </button>
              </form>
            </div>}
        </div>
        {/* Contact Info */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-soft p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Contact Information
            </h2>
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-300 mr-3">
                  <MailIcon size={20} />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    Email
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    support@dentalclinic.ai
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-300 mr-3">
                  <PhoneIcon size={20} />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    Phone
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    1-800-DENTAL-AI
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center text-purple-600 dark:text-purple-300 mr-3">
                  <ClockIcon size={20} />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    Hours
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Mon-Fri: 9am - 6pm EST
                    <br />
                    Sat-Sun: Closed
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl shadow-md p-6">
            <h3 className="font-semibold mb-2">Response Time</h3>
            <p className="text-sm opacity-90">
              We typically respond to all inquiries within 24 hours during
              business days. Urgent issues are prioritized and addressed as
              quickly as possible.
            </p>
          </div>
        </div>
      </div>
    </div>;
};
