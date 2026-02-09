import React, { useState } from 'react';
import { HelpCircleIcon, SearchIcon, BookOpenIcon, VideoIcon, MessageSquareIcon, FileTextIcon, CheckCircleIcon, AlertCircleIcon, ChevronRightIcon, ExternalLinkIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
export const HelpCenter: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const categories = [{
    id: 'getting-started',
    name: 'Getting Started',
    icon: <BookOpenIcon size={24} />,
    color: 'blue',
    articles: 12
  }, {
    id: 'appointments',
    name: 'Appointments',
    icon: <CheckCircleIcon size={24} />,
    color: 'green',
    articles: 8
  }, {
    id: 'inventory',
    name: 'Inventory Management',
    icon: <FileTextIcon size={24} />,
    color: 'yellow',
    articles: 10
  }, {
    id: 'ai-agents',
    name: 'AI Agents',
    icon: <MessageSquareIcon size={24} />,
    color: 'purple',
    articles: 15
  }];
  const popularArticles = [{
    title: 'How to schedule your first appointment',
    category: 'Getting Started',
    views: 1250
  }, {
    title: 'Understanding AI agent suggestions',
    category: 'AI Agents',
    views: 980
  }, {
    title: 'Managing inventory alerts',
    category: 'Inventory Management',
    views: 856
  }, {
    title: 'Setting up automated reminders',
    category: 'Appointments',
    views: 742
  }];
  const faqs = [{
    question: 'How do I add a new patient',
    answer: "Navigate to the Patients section and click the 'Add Patient' button. Fill in the required information including name, contact details, and medical history."
  }, {
    question: 'Can I customize AI agent behavior',
    answer: "Yes! Go to Settings > AI Agent Settings to configure each agent's behavior, enable/disable features, and set custom thresholds."
  }, {
    question: 'How do inventory alerts work',
    answer: 'The system monitors your inventory levels and sends alerts when items fall below your configured thresholds. You can set both low stock and critical stock levels.'
  }, {
    question: 'What payment methods are supported',
    answer: 'The clinic supports cash, credit cards, debit cards, insurance, and checks. You can configure accepted payment methods in Clinic Settings.'
  }];
  return <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
          <HelpCircleIcon size={24} className="mr-2 text-blue-600 dark:text-blue-400" />
          Help & Support
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">
          Find answers, learn features, and get the most out of Dental Clinic AI
        </p>
      </div>
      {/* Search Bar */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl shadow-md p-8 mb-6">
        <h2 className="text-2xl font-bold mb-4">How can we help you</h2>
        <div className="relative">
          <input type="text" placeholder="Search for help articles, guides, and more..." className="w-full px-6 py-4 pl-12 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-300" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          <SearchIcon size={20} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
        </div>
      </div>
      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Link to="/app/help/documentation" className="bg-white dark:bg-slate-800 rounded-xl shadow-soft p-6 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-300 mb-4">
            <BookOpenIcon size={24} />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
            Documentation
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Complete guides and references
          </p>
        </Link>
        <Link to="/app/help/videos" className="bg-white dark:bg-slate-800 rounded-xl shadow-soft p-6 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center text-purple-600 dark:text-purple-300 mb-4">
            <VideoIcon size={24} />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
            Video Tutorials
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Step-by-step video guides
          </p>
        </Link>
        <Link to="/app/help/contact" className="bg-white dark:bg-slate-800 rounded-xl shadow-soft p-6 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-300 mb-4">
            <MessageSquareIcon size={24} />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
            Contact Support
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Get help from our team
          </p>
        </Link>
        <a href="https://status.dentalclinic.ai" target="_blank" rel="noopener noreferrer" className="bg-white dark:bg-slate-800 rounded-xl shadow-soft p-6 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center text-yellow-600 dark:text-yellow-300 mb-4">
            <AlertCircleIcon size={24} />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center">
            System Status
            <ExternalLinkIcon size={14} className="ml-2" />
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Check service availability
          </p>
        </a>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Categories */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-soft p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Browse by Category
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categories.map(category => <button key={category.id} onClick={() => setSelectedCategory(category.id)} className="p-4 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors text-left">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start">
                      <div className={`w-10 h-10 bg-${category.color}-100 dark:bg-${category.color}-900/30 rounded-lg flex items-center justify-center text-${category.color}-600 dark:text-${category.color}-300 mr-3`}>
                        {category.icon}
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {category.name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {category.articles} articles
                        </p>
                      </div>
                    </div>
                    <ChevronRightIcon size={20} className="text-gray-400 dark:text-gray-500" />
                  </div>
                </button>)}
            </div>
          </div>
          {/* Popular Articles */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-soft p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Popular Articles
            </h2>
            <div className="space-y-4">
              {popularArticles.map((article, index) => <div key={index} className="p-4 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                    {article.title}
                  </h3>
                  <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                    <span>{article.category}</span>
                    <span>{article.views} views</span>
                  </div>
                </div>)}
            </div>
          </div>
        </div>
        {/* Sidebar */}
        <div className="space-y-6">
          {/* FAQs */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-soft p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Frequently Asked Questions
            </h2>
            <div className="space-y-4">
              {faqs.map((faq, index) => <details key={index} className="group">
                  <summary className="font-medium text-gray-900 dark:text-white cursor-pointer list-none flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50">
                    <span>{faq.question}</span>
                    <ChevronRightIcon size={16} className="text-gray-400 group-open:rotate-90 transition-transform" />
                  </summary>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 px-3 pb-3">
                    {faq.answer}
                  </p>
                </details>)}
            </div>
          </div>
          {/* Contact Card */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl shadow-md p-6">
            <h3 className="font-semibold mb-2">Still need help</h3>
            <p className="text-sm opacity-90 mb-4">
              Our support team is here to help you with any questions.
            </p>
            <Link to="/app/help/contact" className="block w-full py-2 bg-white text-blue-600 rounded-lg font-medium text-center hover:bg-blue-50 transition-colors">
              Contact Support
            </Link>
          </div>
        </div>
      </div>
    </div>;
};