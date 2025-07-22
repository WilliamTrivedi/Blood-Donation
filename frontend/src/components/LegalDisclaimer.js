import React, { useState } from 'react';

const LegalDisclaimer = ({ onAccept, show = true }) => {
  const [hasScrolled, setHasScrolled] = useState(false);

  const handleScroll = (e) => {
    const element = e.target;
    if (element.scrollTop + element.clientHeight >= element.scrollHeight - 10) {
      setHasScrolled(true);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl max-h-96 overflow-hidden shadow-2xl">
        <div className="bg-red-600 text-white p-4">
          <h2 className="text-xl font-bold flex items-center">
            ⚠️ IMPORTANT MEDICAL DISCLAIMER
          </h2>
        </div>
        
        <div 
          className="p-6 max-h-64 overflow-y-auto text-sm leading-relaxed"
          onScroll={handleScroll}
        >
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
              <h3 className="font-bold text-yellow-800 mb-2">🚨 FOR DEMONSTRATION PURPOSES ONLY</h3>
              <p className="text-yellow-700">
                This BloodConnect system is a demonstration platform and should <strong>NOT</strong> be used for actual medical emergencies or blood donation coordination.
              </p>
            </div>

            <div>
              <h3 className="font-bold mb-2">Medical Emergency Instructions:</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>For actual medical emergencies, call <strong>911</strong> immediately</li>
                <li>Contact your local hospital or blood bank directly</li>
                <li>Use established medical emergency services</li>
                <li>Do not rely on this demonstration system for real medical needs</li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold mb-2">System Limitations:</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>This is a technology demonstration, not a medical device</li>
                <li>No medical verification of users or requests</li>
                <li>No guarantee of donor availability or response</li>
                <li>No medical screening or safety protocols implemented</li>
                <li>Data may not be secure or HIPAA compliant</li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold mb-2">Legal Notice:</h3>
              <p>
                By using this system, you acknowledge that this is a demonstration platform only. 
                The developers assume no responsibility for any medical decisions or actions taken 
                based on information from this system. This platform is not intended to replace 
                professional medical advice, diagnosis, or treatment.
              </p>
            </div>

            <div>
              <h3 className="font-bold mb-2">Data Usage:</h3>
              <p>
                Any data entered is for demonstration purposes only. Do not enter real personal 
                medical information. This system is not secure for actual medical data.
              </p>
            </div>

            <div className="bg-red-50 border border-red-200 rounded p-3">
              <h3 className="font-bold text-red-800 mb-2">⚠️ ALWAYS CONSULT MEDICAL PROFESSIONALS</h3>
              <p className="text-red-700">
                For any medical emergency or blood donation needs, contact licensed medical 
                professionals and established healthcare institutions immediately.
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-50 px-6 py-4 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {hasScrolled ? "✅ You have read the full disclaimer" : "📖 Please scroll to read the full disclaimer"}
          </div>
          <button
            onClick={onAccept}
            disabled={!hasScrolled}
            className={`px-6 py-2 rounded font-semibold ${
              hasScrolled 
                ? 'bg-red-600 text-white hover:bg-red-700' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            I Understand - This is Demo Only
          </button>
        </div>
      </div>
    </div>
  );
};

export default LegalDisclaimer;