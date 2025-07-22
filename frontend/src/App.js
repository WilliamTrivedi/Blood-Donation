import React, { useState, useEffect } from "react";
import "./App.css";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const URGENCY_LEVELS = ["Critical", "Urgent", "Normal"];

function App() {
  const [activeTab, setActiveTab] = useState("home");
  const [donors, setDonors] = useState([]);
  const [bloodRequests, setBloodRequests] = useState([]);
  const [stats, setStats] = useState(null);
  const [matchedDonors, setMatchedDonors] = useState(null);
  const [selectedRequestId, setSelectedRequestId] = useState(null);

  // Form states
  const [donorForm, setDonorForm] = useState({
    name: "",
    phone: "",
    email: "",
    blood_type: "",
    age: "",
    city: "",
    state: ""
  });

  const [requestForm, setRequestForm] = useState({
    requester_name: "",
    patient_name: "",
    phone: "",
    email: "",
    blood_type_needed: "",
    urgency: "",
    units_needed: "",
    hospital_name: "",
    city: "",
    state: "",
    description: ""
  });

  useEffect(() => {
    fetchStats();
    if (activeTab === "donors") fetchDonors();
    if (activeTab === "requests") fetchBloodRequests();
  }, [activeTab]);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/stats`);
      setStats(response.data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchDonors = async () => {
    try {
      const response = await axios.get(`${API}/donors`);
      setDonors(response.data);
    } catch (error) {
      console.error("Error fetching donors:", error);
    }
  };

  const fetchBloodRequests = async () => {
    try {
      const response = await axios.get(`${API}/blood-requests`);
      setBloodRequests(response.data);
    } catch (error) {
      console.error("Error fetching blood requests:", error);
    }
  };

  const handleDonorSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/donors`, donorForm);
      alert("Donor registered successfully!");
      setDonorForm({
        name: "",
        phone: "",
        email: "",
        blood_type: "",
        age: "",
        city: "",
        state: ""
      });
      fetchStats();
    } catch (error) {
      alert(error.response?.data?.detail || "Error registering donor");
    }
  };

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/blood-requests`, {
        ...requestForm,
        units_needed: parseInt(requestForm.units_needed)
      });
      alert("Blood request created successfully!");
      setRequestForm({
        requester_name: "",
        patient_name: "",
        phone: "",
        email: "",
        blood_type_needed: "",
        urgency: "",
        units_needed: "",
        hospital_name: "",
        city: "",
        state: "",
        description: ""
      });
      fetchStats();
    } catch (error) {
      alert(error.response?.data?.detail || "Error creating blood request");
    }
  };

  const findMatches = async (requestId) => {
    try {
      const response = await axios.get(`${API}/match-donors/${requestId}`);
      setMatchedDonors(response.data);
      setSelectedRequestId(requestId);
    } catch (error) {
      console.error("Error finding matches:", error);
    }
  };

  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case "Critical": return "text-red-600 bg-red-100";
      case "Urgent": return "text-orange-600 bg-orange-100";
      case "Normal": return "text-green-600 bg-green-100";
      default: return "text-gray-600 bg-gray-100";
    }
  };

  const renderHome = () => (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-white">
        <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
          <div className="mx-auto grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 sm:gap-y-20 lg:mx-0 lg:max-w-none lg:grid-cols-2 lg:items-center">
            <div className="lg:pr-8">
              <div className="lg:max-w-lg">
                <p className="text-base font-semibold leading-7 text-red-600">Save Lives</p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                  Connect Blood Donors with Those in Need
                </h1>
                <p className="mt-6 text-lg leading-8 text-gray-600">
                  Join our nationwide blood donation network. Register as a donor to help save lives, 
                  or request blood for urgent medical needs. Every donation matters.
                </p>
                <div className="mt-8 flex gap-4">
                  <button
                    onClick={() => setActiveTab("register-donor")}
                    className="rounded-md bg-red-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-red-500"
                  >
                    Become a Donor
                  </button>
                  <button
                    onClick={() => setActiveTab("request-blood")}
                    className="rounded-md bg-pink-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-pink-500"
                  >
                    Request Blood
                  </button>
                </div>
              </div>
            </div>
            <div className="relative">
              <img
                src="https://images.unsplash.com/photo-1615461066159-fea0960485d5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2MzR8MHwxfHNlYXJjaHwxfHxibG9vZCUyMGRvbmF0aW9ufGVufDB8fHx8MTc1MzE2NDU3NXww&ixlib=rb-4.1.0&q=85"
                alt="Blood donation"
                className="rounded-lg shadow-2xl"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      {stats && (
        <div className="bg-white py-16">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Current Network Status
              </h2>
              <p className="mt-4 text-lg leading-8 text-gray-600">
                Real-time data from our blood donation network
              </p>
            </div>
            <div className="mx-auto mt-12 grid max-w-lg gap-8 sm:max-w-4xl sm:grid-cols-2 lg:max-w-none lg:grid-cols-4">
              <div className="text-center">
                <div className="mx-auto h-20 w-20 rounded-full bg-red-100 flex items-center justify-center">
                  <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="mt-4 text-2xl font-bold text-gray-900">{stats.total_donors}</h3>
                <p className="text-sm text-gray-600">Active Donors</p>
              </div>
              <div className="text-center">
                <div className="mx-auto h-20 w-20 rounded-full bg-pink-100 flex items-center justify-center">
                  <svg className="h-8 w-8 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="mt-4 text-2xl font-bold text-gray-900">{stats.total_active_requests}</h3>
                <p className="text-sm text-gray-600">Active Requests</p>
              </div>
              <div className="text-center">
                <div className="mx-auto h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="mt-4 text-2xl font-bold text-gray-900">24/7</h3>
                <p className="text-sm text-gray-600">Available</p>
              </div>
              <div className="text-center">
                <div className="mx-auto h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center">
                  <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h3 className="mt-4 text-2xl font-bold text-gray-900">National</h3>
                <p className="text-sm text-gray-600">Coverage</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderDonorRegistration = () => (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white shadow-xl rounded-lg p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Register as Blood Donor</h2>
        <form onSubmit={handleDonorSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Full Name</label>
              <input
                type="text"
                value={donorForm.name}
                onChange={(e) => setDonorForm({...donorForm, name: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 border p-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <input
                type="tel"
                value={donorForm.phone}
                onChange={(e) => setDonorForm({...donorForm, phone: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 border p-2"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={donorForm.email}
              onChange={(e) => setDonorForm({...donorForm, email: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 border p-2"
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Blood Type</label>
              <select
                value={donorForm.blood_type}
                onChange={(e) => setDonorForm({...donorForm, blood_type: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 border p-2"
                required
              >
                <option value="">Select Blood Type</option>
                {BLOOD_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Age</label>
              <input
                type="number"
                min="18"
                max="65"
                value={donorForm.age}
                onChange={(e) => setDonorForm({...donorForm, age: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 border p-2"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">City</label>
              <input
                type="text"
                value={donorForm.city}
                onChange={(e) => setDonorForm({...donorForm, city: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 border p-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">State</label>
              <input
                type="text"
                value={donorForm.state}
                onChange={(e) => setDonorForm({...donorForm, state: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 border p-2"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            Register as Donor
          </button>
        </form>
      </div>
    </div>
  );

  const renderBloodRequest = () => (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white shadow-xl rounded-lg p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Request Blood</h2>
        <form onSubmit={handleRequestSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Your Name</label>
              <input
                type="text"
                value={requestForm.requester_name}
                onChange={(e) => setRequestForm({...requestForm, requester_name: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500 border p-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Patient Name</label>
              <input
                type="text"
                value={requestForm.patient_name}
                onChange={(e) => setRequestForm({...requestForm, patient_name: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500 border p-2"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <input
                type="tel"
                value={requestForm.phone}
                onChange={(e) => setRequestForm({...requestForm, phone: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500 border p-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={requestForm.email}
                onChange={(e) => setRequestForm({...requestForm, email: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500 border p-2"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Blood Type Needed</label>
              <select
                value={requestForm.blood_type_needed}
                onChange={(e) => setRequestForm({...requestForm, blood_type_needed: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500 border p-2"
                required
              >
                <option value="">Select Blood Type</option>
                {BLOOD_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Urgency</label>
              <select
                value={requestForm.urgency}
                onChange={(e) => setRequestForm({...requestForm, urgency: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500 border p-2"
                required
              >
                <option value="">Select Urgency</option>
                {URGENCY_LEVELS.map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Units Needed</label>
              <input
                type="number"
                min="1"
                max="10"
                value={requestForm.units_needed}
                onChange={(e) => setRequestForm({...requestForm, units_needed: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500 border p-2"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Hospital Name</label>
            <input
              type="text"
              value={requestForm.hospital_name}
              onChange={(e) => setRequestForm({...requestForm, hospital_name: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500 border p-2"
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">City</label>
              <input
                type="text"
                value={requestForm.city}
                onChange={(e) => setRequestForm({...requestForm, city: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500 border p-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">State</label>
              <input
                type="text"
                value={requestForm.state}
                onChange={(e) => setRequestForm({...requestForm, state: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500 border p-2"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Additional Description</label>
            <textarea
              value={requestForm.description}
              onChange={(e) => setRequestForm({...requestForm, description: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500 border p-2"
              rows="3"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-pink-600 text-white py-2 px-4 rounded-md hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2"
          >
            Submit Blood Request
          </button>
        </form>
      </div>
    </div>
  );

  const renderBloodRequests = () => (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white shadow-xl rounded-lg p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Active Blood Requests</h2>
        {bloodRequests.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No active blood requests at the moment.</p>
        ) : (
          <div className="space-y-4">
            {bloodRequests.map((request) => (
              <div key={request.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {request.patient_name}
                    </h3>
                    <p className="text-sm text-gray-600">Requested by: {request.requester_name}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getUrgencyColor(request.urgency)}`}>
                    {request.urgency}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <span className="text-sm text-gray-500">Blood Type:</span>
                    <p className="font-semibold text-red-600">{request.blood_type_needed}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Units:</span>
                    <p className="font-semibold">{request.units_needed}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Location:</span>
                    <p className="font-semibold">{request.city}, {request.state}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Hospital:</span>
                    <p className="font-semibold">{request.hospital_name}</p>
                  </div>
                </div>
                {request.description && (
                  <p className="text-gray-600 mb-4">{request.description}</p>
                )}
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-500">
                    Contact: {request.phone} | {request.email}
                  </p>
                  <button
                    onClick={() => findMatches(request.id)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                  >
                    Find Matching Donors
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Matched Donors Modal */}
        {matchedDonors && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-4xl max-h-96 overflow-y-auto p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Matching Donors ({matchedDonors.total_matches})</h3>
                <button
                  onClick={() => setMatchedDonors(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              {matchedDonors.compatible_donors.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No matching donors found.</p>
              ) : (
                <div className="space-y-3">
                  {matchedDonors.compatible_donors.map((match, index) => (
                    <div key={index} className="border border-gray-200 rounded p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold">{match.donor.name}</h4>
                          <p className="text-sm text-gray-600">
                            {match.donor.blood_type} • {match.donor.city}, {match.donor.state}
                          </p>
                          <p className="text-sm text-gray-600">
                            Age: {match.donor.age} • Contact: {match.donor.phone}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-1 rounded text-sm ${
                            match.compatibility === 'Direct' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {match.compatibility}
                          </span>
                          {match.location_match === 2 && (
                            <span className="block text-xs text-green-600 mt-1">Same City</span>
                          )}
                          {match.location_match === 1 && (
                            <span className="block text-xs text-blue-600 mt-1">Same State</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderDonors = () => (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white shadow-xl rounded-lg p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Available Donors</h2>
        {donors.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No donors registered yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {donors.map((donor) => (
              <div key={donor.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md">
                <h3 className="font-semibold text-gray-900">{donor.name}</h3>
                <p className="text-red-600 font-bold text-lg">{donor.blood_type}</p>
                <p className="text-sm text-gray-600">{donor.city}, {donor.state}</p>
                <p className="text-sm text-gray-600">Age: {donor.age}</p>
                <div className="mt-2">
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                    Available
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold">B+</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">BloodConnect</h1>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={() => setActiveTab("home")}
                className={`px-4 py-2 rounded-md ${activeTab === "home" ? "bg-red-600 text-white" : "text-gray-600 hover:text-red-600"}`}
              >
                Home
              </button>
              <button
                onClick={() => setActiveTab("register-donor")}
                className={`px-4 py-2 rounded-md ${activeTab === "register-donor" ? "bg-red-600 text-white" : "text-gray-600 hover:text-red-600"}`}
              >
                Become Donor
              </button>
              <button
                onClick={() => setActiveTab("request-blood")}
                className={`px-4 py-2 rounded-md ${activeTab === "request-blood" ? "bg-red-600 text-white" : "text-gray-600 hover:text-red-600"}`}
              >
                Request Blood
              </button>
              <button
                onClick={() => setActiveTab("requests")}
                className={`px-4 py-2 rounded-md ${activeTab === "requests" ? "bg-red-600 text-white" : "text-gray-600 hover:text-red-600"}`}
              >
                View Requests
              </button>
              <button
                onClick={() => setActiveTab("donors")}
                className={`px-4 py-2 rounded-md ${activeTab === "donors" ? "bg-red-600 text-white" : "text-gray-600 hover:text-red-600"}`}
              >
                View Donors
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      {activeTab === "home" && renderHome()}
      {activeTab === "register-donor" && renderDonorRegistration()}
      {activeTab === "request-blood" && renderBloodRequest()}
      {activeTab === "requests" && renderBloodRequests()}
      {activeTab === "donors" && renderDonors()}
    </div>
  );
}

export default App;