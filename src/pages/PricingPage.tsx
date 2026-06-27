import Header from '../components/layout/Header';
import { Check, X } from 'lucide-react';

const tiers = [
  {
    name: 'Free',
    price: '$0',
    description: 'Perfect for trying out social automation',
    features: [
      'Up to 10 accounts',
      'Basic execution history',
      'Manual runs only',
      'Standard anti-detection',
      'Community support'
    ],
    missing: [
      'Scheduled cron runs',
      'Engagement analytics',
      'Custom workflows',
      'Priority support'
    ],
    buttonText: 'Current Plan',
    buttonClass: 'bg-gray-100 text-gray-900 cursor-default'
  },
  {
    name: 'Pro',
    price: '$49',
    period: '/mo',
    description: 'For growing social automation teams',
    features: [
      'Up to 100 accounts',
      'Advanced analytics & 30-day history',
      'Scheduled cron runs',
      'Premium anti-detection profiles',
      'Email support',
      'Account block auto-rotation'
    ],
    missing: [
      'Custom IP/Proxy integration',
      'White-label reporting'
    ],
    buttonText: 'Upgrade to Pro',
    buttonClass: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'For agencies running automation at scale',
    features: [
      'Unlimited accounts',
      'Unlimited execution history',
      'API access & Webhooks',
      'Custom IP/Proxy integration',
      'White-label reporting',
      'Dedicated success manager',
      'Custom workflow development'
    ],
    missing: [],
    buttonText: 'Contact Sales',
    buttonClass: 'bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50'
  }
];

export default function PricingPage() {
  return (
    <>
      <Header
        title="Plans & Pricing"
        subtitle="Scale your social automation"
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
            {tiers.map((tier) => (
              <div 
                key={tier.name}
                className={`bg-white rounded-2xl border ${
                  tier.name === 'Pro' ? 'border-indigo-500 shadow-lg relative ring-1 ring-indigo-500' : 'border-gray-200 shadow-sm'
                } p-8 flex flex-col`}
              >
                {tier.name === 'Pro' && (
                  <span className="absolute top-0 right-6 -translate-y-1/2 bg-indigo-500 text-white px-3 py-0.5 text-sm font-medium rounded-full">
                    Most Popular
                  </span>
                )}
                
                <h3 className="text-xl font-semibold text-gray-900">{tier.name}</h3>
                <p className="text-sm text-gray-500 mt-2 min-h-[40px]">{tier.description}</p>
                
                <div className="my-6">
                  <span className="text-4xl font-bold text-gray-900">{tier.price}</span>
                  {tier.period && <span className="text-gray-500">{tier.period}</span>}
                </div>
                
                <button 
                  className={`w-full py-2.5 px-4 rounded-lg font-medium text-sm transition-colors ${tier.buttonClass}`}
                >
                  {tier.buttonText}
                </button>
                
                <div className="mt-8 flex-1">
                  <h4 className="text-sm font-medium text-gray-900 mb-4">What's included:</h4>
                  <ul className="space-y-3">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start">
                        <Check className="w-5 h-5 text-emerald-500 shrink-0 mr-3" />
                        <span className="text-sm text-gray-600">{feature}</span>
                      </li>
                    ))}
                    {tier.missing.map((feature) => (
                      <li key={feature} className="flex items-start opacity-50">
                        <X className="w-5 h-5 text-gray-300 shrink-0 mr-3" />
                        <span className="text-sm text-gray-500">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
          
        </div>
      </div>
    </>
  );
}
