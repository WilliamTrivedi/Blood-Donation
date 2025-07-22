import React, { useState, useEffect } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const HospitalDashboard = ({ user }) => {
  const [hospital, setHospital] = useState(null);
  const [hospitalRequests, setHospitalRequests] = useState([]);
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const [hospitalForm, setHospitalForm] = useState({
    name: '',
    license_number: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    website: '',
    contact_person_name: '',
    contact_person_title: '',
    contact_person_phone: '',
    contact_person_email: ''
  });

  useEffect(() => {
    if (user?.role === 'hospital') {
      fetchHospitalData();
    }
  }, [user]);

  const fetchHospitalData = async () => {
    setLoading(true);
    try {
      // Check if user has a hospital profile
      if (user?.hospital_id) {
        const hospitalResponse = await axios.get(`${API}/hospitals/${user.hospital_id}`);
        setHospital(hospitalResponse.data);
        
        // Fetch hospital's blood requests
        const requestsResponse = await axios.get(`${API}/blood-requests`);
        const userRequests = requestsResponse.data.filter(req => req.user_id === user.id);
        setHospitalRequests(userRequests);
      }
    } catch (error) {
      console.error('Error fetching hospital data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleHospitalSubmit = async (e) => {
    e.preventDefault();
    setFormErrors({});
    
    try {
      const response = await axios.post(`${API}/hospitals`, hospitalForm, {
        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` }
      });
      
      setHospital(response.data);
      setShowRegistrationForm(false);
      alert('🏥 Hospital registration submitted successfully! Pending admin verification.');
      
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 'Error registering hospital';
      if (typeof errorMessage === 'object') {
        setFormErrors(errorMessage);
      } else {
        alert(`❌ Registration Failed: ${errorMessage}`);
      }
    }
  };

  const updateRequestStatus = async (requestId, status) => {
    try {
      await axios.put(`${API}/blood-requests/${requestId}/status?status=${status}`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` }
      });
      
      alert(`Request status updated to ${status}!`);
      fetchHospitalData(); // Refresh data
      
    } catch (error) {
      alert(`Error: ${error.response?.data?.detail || 'Failed to update request status'}`);
    }
  };

  if (user?.role !== 'hospital') {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="text-xl font-bold text-red-800 mb-2">Access Denied</h2>
          <p className="text-red-600">Hospital access required to view this dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">🏥 Hospital Dashboard</h1>
        <p className="text-gray-600">Manage your hospital profile and blood requests</p>
        
        {user?.demo && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mt-4">
            <p className="text-yellow-800 text-sm">
              <strong>Demo Hospital Mode:</strong> You can explore hospital features but registrations won't be permanent.
            </p>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          <span className="ml-2 text-gray-600">Loading hospital dashboard...</span>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Hospital Profile Section */}
          {!hospital && !showRegistrationForm && (
            <div className="bg-white shadow-lg rounded-lg p-6 text-center">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Hospital Registration Required</h2>
              <p className="text-gray-600 mb-6">
                To access hospital features, please register your hospital for verification.
              </p>
              <button
                onClick={() => setShowRegistrationForm(true)}
                className="bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700"
              >
                🏥 Register Hospital
              </button>
            </div>
          )}

          {/* Hospital Registration Form */}
          {showRegistrationForm && (
            <div className="bg-white shadow-lg rounded-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">🏥 Hospital Registration</h2>
              
              <form onSubmit={handleHospitalSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Hospital Name *</label>
                    <input
                      type="text"
                      value={hospitalForm.name}
                      onChange={(e) => setHospitalForm({...hospitalForm, name: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">License Number *</label>
                    <input
                      type="text"
                      value={hospitalForm.license_number}
                      onChange={(e) => setHospitalForm({...hospitalForm, license_number: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone *</label>
                    <input
                      type="tel"
                      value={hospitalForm.phone}
                      onChange={(e) => setHospitalForm({...hospitalForm, phone: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email *</label>
                    <input
                      type="email"
                      value={hospitalForm.email}
                      onChange={(e) => setHospitalForm({...hospitalForm, email: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Address *</label>
                  <textarea
                    value={hospitalForm.address}
                    onChange={(e) => setHospitalForm({...hospitalForm, address: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    rows="2"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">City *</label>
                    <input
                      type="text"
                      value={hospitalForm.city}
                      onChange={(e) => setHospitalForm({...hospitalForm, city: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">State *</label>
                    <input
                      type="text"
                      value={hospitalForm.state}
                      onChange={(e) => setHospitalForm({...hospitalForm, state: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">ZIP Code *</label>
                    <input
                      type="text"
                      value={hospitalForm.zip_code}
                      onChange={(e) => setHospitalForm({...hospitalForm, zip_code: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Website</label>
                  <input
                    type="url"
                    value={hospitalForm.website}
                    onChange={(e) => setHospitalForm({...hospitalForm, website: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Contact Person Information</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Contact Person Name *</label>
                      <input
                        type="text"
                        value={hospitalForm.contact_person_name}
                        onChange={(e) => setHospitalForm({...hospitalForm, contact_person_name: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Title *</label>
                      <input
                        type="text"
                        value={hospitalForm.contact_person_title}
                        onChange={(e) => setHospitalForm({...hospitalForm, contact_person_title: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Contact Phone *</label>
                      <input
                        type="tel"
                        value={hospitalForm.contact_person_phone}
                        onChange={(e) => setHospitalForm({...hospitalForm, contact_person_phone: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Contact Email *</label>
                      <input
                        type="email"
                        value={hospitalForm.contact_person_email}
                        onChange={(e) => setHospitalForm({...hospitalForm, contact_person_email: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="flex space-x-4">
                  <button
                    type="submit"
                    className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700"
                  >
                    Submit for Verification
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRegistrationForm(false)}
                    className="bg-gray-300 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Hospital Profile Display */}
          {hospital && (
            <div className="bg-white shadow-lg rounded-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{hospital.name}</h2>
                  <p className="text-gray-600">License: {hospital.license_number}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  hospital.status === 'verified' 
                    ? 'bg-green-100 text-green-800'
                    : hospital.status === 'pending'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {hospital.status}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><strong>Phone:</strong> {hospital.phone}</div>
                <div><strong>Email:</strong> {hospital.email}</div>
                <div><strong>Address:</strong> {hospital.address}</div>
                <div><strong>Location:</strong> {hospital.city}, {hospital.state} {hospital.zip_code}</div>
                <div><strong>Contact:</strong> {hospital.contact_person_name} ({hospital.contact_person_title})</div>
                <div><strong>Contact Phone:</strong> {hospital.contact_person_phone}</div>
              </div>
            </div>
          )}

          {/* Hospital Blood Requests */}
          {hospital && (
            <div className="bg-white shadow-lg rounded-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">🩸 Your Blood Requests</h2>
              
              {hospitalRequests.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No blood requests created yet.</p>
              ) : (
                <div className="space-y-4">
                  {hospitalRequests.map((request) => (
                    <div key={request.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-semibold">{request.patient_name}</h3>
                          <p className="text-sm text-gray-600">Blood Type: {request.blood_type_needed}</p>
                        </div>
                        <div className="flex space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            request.urgency === 'Critical' ? 'bg-red-100 text-red-800' :
                            request.urgency === 'Urgent' ? 'bg-orange-100 text-orange-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {request.urgency}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            request.status === 'Active' ? 'bg-blue-100 text-blue-800' :
                            request.status === 'Fulfilled' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {request.status}
                          </span>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-3">
                        Units needed: {request.units_needed} | Views: {request.views_count || 0}
                      </p>
                      
                      {request.status === 'Active' && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => updateRequestStatus(request.id, 'Fulfilled')}
                            className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                          >
                            ✅ Mark Fulfilled
                          </button>
                          <button
                            onClick={() => updateRequestStatus(request.id, 'Cancelled')}
                            className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700"
                          >
                            ❌ Cancel Request
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HospitalDashboard;