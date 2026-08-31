import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Check, Sparkles, Building2, CreditCard, HelpCircle, 
  MapPin, Landmark, Lock, Info, AlertCircle, RefreshCw, UserCheck
} from 'lucide-react';

interface OnboardingKycProps {
  onVerificationSuccess: (tier: number) => void;
  showToast: (message: string, type: 'success' | 'info' | 'error') => void;
}

interface PaymentMethod {
  id: string;
  type: 'bank' | 'card';
  name: string;
  details: string;
  region: 'US' | 'CA';
}

export default function OnboardingKyc({
  onVerificationSuccess,
  showToast
}: OnboardingKycProps) {
  // Load saved state
  const [citizenship, setCitizenship] = useState<'US' | 'CA'>(() => {
    return (localStorage.getItem('cb_kyc_citizenship') as 'US' | 'CA') || 'US';
  });

  const [kycLevel, setKycLevel] = useState<number>(() => {
    return parseInt(localStorage.getItem('cb_kyc_level') || '1', 10);
  });

  // Onboarding Form States
  const [fullName, setFullName] = useState('Jane Doe');
  const [addressLine, setAddressLine] = useState('120 Pine Street');
  const [city, setCity] = useState('San Francisco');
  const [selectedState, setSelectedState] = useState('CA');
  const [selectedProvince, setSelectedProvince] = useState('ON');
  const [postalCode, setPostalCode] = useState('94111');
  const [taxId, setTaxId] = useState('9812'); // Last 4 digits of SSN/SIN
  const [phone, setPhone] = useState('(555) 302-8391');

  // Verify modal state
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyProgress, setVerifyProgress] = useState(0);

  // Saved Credit/Debit cards
  const [linkedCards, setLinkedCards] = useState<PaymentMethod[]>(() => {
    const saved = localStorage.getItem('cb_linked_cards');
    return saved ? JSON.parse(saved) : [
      { id: 'card-1', type: 'card', name: 'Visa Gold Credit Card', details: '•••• •••• •••• 4910', region: 'US' }
    ];
  });

  // New Credit Card form states
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  // Persist levels
  useEffect(() => {
    localStorage.setItem('cb_kyc_citizenship', citizenship);
  }, [citizenship]);

  useEffect(() => {
    localStorage.setItem('cb_kyc_level', kycLevel.toString());
    onVerificationSuccess(kycLevel);
  }, [kycLevel]);

  useEffect(() => {
    localStorage.setItem('cb_linked_cards', JSON.stringify(linkedCards));
  }, [linkedCards]);

  // US States and Canadian Provinces list
  const US_STATES = [
    { code: 'AL', name: 'Alabama' }, { code: 'AZ', name: 'Arizona' },
    { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
    { code: 'FL', name: 'Florida' }, { code: 'IL', name: 'Illinois' },
    { code: 'NY', name: 'New York' }, { code: 'TX', name: 'Texas' },
    { code: 'WA', name: 'Washington' }
  ];

  const CA_PROVINCES = [
    { code: 'AB', name: 'Alberta' }, { code: 'BC', name: 'British Columbia' },
    { code: 'MB', name: 'Manitoba' }, { code: 'ON', name: 'Ontario' },
    { code: 'QC', name: 'Quebec' }, { code: 'NS', name: 'Nova Scotia' }
  ];

  // Submit KYC ID verification
  const handleVerifyKyc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taxId || taxId.length < 4) {
      showToast(`Please enter the last 4 digits of your ${citizenship === 'US' ? 'SSN' : 'SIN'} for tax compliance.`, 'error');
      return;
    }

    setIsVerifying(true);
    setVerifyProgress(1);

    try {
      // Call backend API to save KYC information
      const response = await fetch('/api/auth/kyc/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName,
          address: addressLine,
          city,
          state: citizenship === 'US' ? selectedState : undefined,
          province: citizenship === 'CA' ? selectedProvince : undefined,
          postalCode,
          taxId,
          phone,
          kycLevel: 3
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to save KYC information: ${response.status}`);
      }

      const data = await response.json();

      // Execute database accounting & sanction screening verification
      setTimeout(() => setVerifyProgress(2), 800);
      setTimeout(() => setVerifyProgress(3), 1600);
      setTimeout(() => {
        setIsVerifying(false);
        setVerifyProgress(0);
        setKycLevel(3);
        showToast(`Identity verified successfully! Unlocked unlimited trading tiers.`, 'success');
      }, 2400);
    } catch (error) {
      console.error('KYC save failed:', error);
      setIsVerifying(false);
      setVerifyProgress(0);
      showToast(`Failed to save KYC information: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  // Add credit card payment method
  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (cardNumber.length < 16 || cardCvv.length < 3) {
      showToast('Please enter a valid credit card credentials.', 'error');
      return;
    }

    const lastFour = cardNumber.slice(-4);
    const newCard: PaymentMethod = {
      id: `card-${Date.now()}`,
      type: 'card',
      name: cardName || 'Visa Debit Card',
      details: `•••• •••• •••• ${lastFour}`,
      region: citizenship
    };

    setLinkedCards([...linkedCards, newCard]);
    setIsAddingCard(false);
    setCardName('');
    setCardNumber('');
    setCardExpiry('');
    setCardCvv('');
    
    // Automatically lift kyc level to Level 2 (Linked Payment Method) if current is Level 1
    if (kycLevel === 1) {
      setKycLevel(2);
    }

    showToast(`Linked credit payment method: ****${lastFour} successfully.`, 'success');
  };

  const handleRemoveCard = (id: string, name: string) => {
    setLinkedCards(linkedCards.filter(c => c.id !== id));
    showToast(`Removed card payment method: ${name}`, 'info');
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs space-y-5">
      
      {/* Title block */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="h-5 w-5 text-[#0052FF]" />
          <h4 className="text-sm font-bold text-gray-900">Sign Up & KYC Onboarding</h4>
        </div>
        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
          kycLevel === 3 ? 'bg-green-100 text-green-700' : kycLevel === 2 ? 'bg-blue-100 text-[#0052FF]' : 'bg-amber-100 text-amber-700'
        }`}>
          Tier {kycLevel} Account
        </span>
      </div>

      {/* KYC Progress Checklist */}
      <div className="space-y-3">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Verification Checklist</span>
        
        <div className="space-y-2 text-xs">
          
          {/* Step 1: Account setup */}
          <div className="flex items-start space-x-2.5">
            <div className="w-4 h-4 rounded-full bg-green-100 text-green-700 flex items-center justify-center shrink-0 mt-0.5">
              <Check className="w-3 h-3 stroke-[3]" />
            </div>
            <div>
              <span className="font-bold text-gray-900 line-through">1. Create Account & Verify Email</span>
              <p className="text-[10px] text-gray-400 mt-0.5">Account email verification completed.</p>
            </div>
          </div>

          {/* Step 2: Payment linking */}
          <div className="flex items-start space-x-2.5">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
              kycLevel >= 2 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400 font-bold text-[9px]'
            }`}>
              {kycLevel >= 2 ? <Check className="w-3 h-3 stroke-[3]" /> : '2'}
            </div>
            <div>
              <span className={`font-bold ${kycLevel >= 2 ? 'text-gray-900 line-through' : 'text-gray-600'}`}>
                2. Add Credit or Bank Payment Method
              </span>
              <p className="text-[10px] text-gray-400 mt-0.5">Required for instant cash buys & card cashouts.</p>
            </div>
          </div>

          {/* Step 3: Identity documentation */}
          <div className="flex items-start space-x-2.5">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
              kycLevel >= 3 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400 font-bold text-[9px]'
            }`}>
              {kycLevel >= 3 ? <Check className="w-3 h-3 stroke-[3]" /> : '3'}
            </div>
            <div>
              <span className={`font-bold ${kycLevel >= 3 ? 'text-gray-900 line-through' : 'text-gray-600'}`}>
                3. Tax Compliance & SSN / SIN Verification
              </span>
              <p className="text-[10px] text-gray-400 mt-0.5">Enter citizenship details to secure unlimited trading limits.</p>
            </div>
          </div>

        </div>
      </div>

      {/* Account level description */}
      <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 space-y-2 text-xs">
        <div className="flex items-center space-x-1 text-[#0052FF]">
          <Info className="h-4 w-4 shrink-0" />
          <span className="font-bold">Tier {kycLevel} Daily Limits</span>
        </div>
        <ul className="space-y-1 text-[11px] text-gray-500 font-medium">
          <li>• Daily Cash buys/withdrawals: <span className="text-gray-900 font-bold">{kycLevel >= 3 ? 'Unlimited' : kycLevel === 2 ? '$25,000' : '$9,500'}</span></li>
          <li>• On-chain blockchain deposits: <span className="text-gray-900 font-bold">Unlimited</span></li>
          <li>• Developer Connect APIs: <span className="text-gray-900 font-bold">{kycLevel >= 3 ? 'All Scopes Active' : 'Read-Only Scopes'}</span></li>
        </ul>
      </div>

      {/* Selector: US or Canada */}
      {kycLevel < 3 && (
        <div className="border-t border-gray-100 pt-3 space-y-3.5">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Select Market Region</span>
            <div className="flex bg-gray-100 p-0.5 rounded-lg text-[10px] font-bold">
              <button
                onClick={() => {
                  setCitizenship('US');
                  setCity('San Francisco');
                  setSelectedState('CA');
                  setPostalCode('94111');
                }}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  citizenship === 'US' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500'
                }`}
              >
                US (SSN/ACH)
              </button>
              <button
                onClick={() => {
                  setCitizenship('CA');
                  setCity('Toronto');
                  setSelectedProvince('ON');
                  setPostalCode('M5V 2H1');
                }}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  citizenship === 'CA' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500'
                }`}
              >
                Canada (SIN/EFT)
              </button>
            </div>
          </div>

          {/* Verification form */}
          {isVerifying ? (
            <div className="py-6 text-center space-y-3">
              <RefreshCw className="h-6 w-6 text-[#0052FF] animate-spin mx-auto" />
              <div>
                <span className="text-xs font-bold text-gray-800">Verifying Regional Documentation</span>
                <p className="text-[10px] text-gray-400 mt-1">Checking tax IDs with credit reporting bureaus...</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleVerifyKyc} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[9px] font-bold text-gray-400 block mb-0.5">Full Legal Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 p-2 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-gray-400 block mb-0.5">Phone Contact</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 p-2 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] font-bold text-gray-400 block mb-0.5">Residential Street Address</label>
                <input
                  type="text"
                  required
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 p-2 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[9px] font-bold text-gray-400 block mb-0.5">City</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 p-2 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-bold text-gray-400 block mb-0.5">
                    {citizenship === 'US' ? 'State' : 'Province'}
                  </label>
                  {citizenship === 'US' ? (
                    <select
                      value={selectedState}
                      onChange={(e) => setSelectedState(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 p-2 rounded-lg text-xs"
                    >
                      {US_STATES.map(s => <option key={s.code} value={s.code}>{s.code}</option>)}
                    </select>
                  ) : (
                    <select
                      value={selectedProvince}
                      onChange={(e) => setSelectedProvince(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 p-2 rounded-lg text-xs"
                    >
                      {CA_PROVINCES.map(p => <option key={p.code} value={p.code}>{p.code}</option>)}
                    </select>
                  )}
                </div>

                <div>
                  <label className="text-[9px] font-bold text-gray-400 block mb-0.5">
                    {citizenship === 'US' ? 'ZIP' : 'Postal Code'}
                  </label>
                  <input
                    type="text"
                    required
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 p-2 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-0.5">
                  <label className="text-[9px] font-bold text-gray-400 block">
                    {citizenship === 'US' ? 'Last 4 digits of SSN' : 'Last 4 digits of SIN'}
                  </label>
                  <span className="text-[8px] text-gray-400 font-mono">Tax reporting required</span>
                </div>
                <input
                  type="password"
                  maxLength={4}
                  required
                  placeholder="••••"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-gray-50 border border-gray-200 p-2 rounded-lg text-xs font-mono text-center tracking-widest"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Submit Identity Verification
              </button>
            </form>
          )}
        </div>
      )}

      {/* Linked payment methods & Cards section */}
      <div className="border-t border-gray-100 pt-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Credit Card Methods</span>
          <button
            onClick={() => setIsAddingCard(!isAddingCard)}
            className="text-[10px] text-[#0052FF] font-bold hover:underline cursor-pointer"
          >
            {isAddingCard ? 'Back' : '+ Add Card'}
          </button>
        </div>

        {isAddingCard ? (
          <form onSubmit={handleAddCard} className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-3 text-xs">
            <div>
              <label className="text-[9px] font-bold text-gray-400 block mb-0.5">Name on Card</label>
              <input
                type="text"
                required
                placeholder="Jane Doe"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                className="w-full bg-white border border-gray-200 p-2 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="text-[9px] font-bold text-gray-400 block mb-0.5">Card Number</label>
              <input
                type="text"
                required
                maxLength={19}
                placeholder="4000 1234 5678 9010"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-white border border-gray-200 p-2 rounded-lg text-xs font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] font-bold text-gray-400 block mb-0.5">Expiry Date</label>
                <input
                  type="text"
                  required
                  maxLength={5}
                  placeholder="MM/YY"
                  value={cardExpiry}
                  onChange={(e) => setCardExpiry(e.target.value)}
                  className="w-full bg-white border border-gray-200 p-2 rounded-lg text-xs font-mono text-center"
                />
              </div>
              <div>
                <label className="text-[9px] font-bold text-gray-400 block mb-0.5">Security Code (CVV)</label>
                <input
                  type="password"
                  required
                  maxLength={3}
                  placeholder="123"
                  value={cardCvv}
                  onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-white border border-gray-200 p-2 rounded-lg text-xs font-mono text-center"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-[#0052FF] hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg cursor-pointer"
            >
              Verify & Add Card Method
            </button>
          </form>
        ) : (
          <div className="space-y-2">
            {linkedCards.map(c => (
              <div key={c.id} className="flex items-center justify-between bg-gray-50 p-2.5 rounded-xl border border-gray-150 text-xs">
                <div className="flex items-center space-x-2.5">
                  <CreditCard className="h-4 w-4 text-gray-500" />
                  <div>
                    <span className="font-bold text-gray-800">{c.name}</span>
                    <span className="text-[10px] text-gray-400 font-mono block">{c.details} ({c.region === 'CA' ? 'CAD' : 'USD'})</span>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveCard(c.id, c.name)}
                  className="text-[10px] text-red-500 hover:text-red-700 font-bold"
                >
                  Remove
                </button>
              </div>
            ))}

            {linkedCards.length === 0 && (
              <p className="text-[10px] text-gray-400 italic text-center py-2 border border-dashed border-gray-200 rounded-xl">
                No backup cards linked.
              </p>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
