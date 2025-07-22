import React, { useState, useEffect } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminDashboard = ({ user }) => {
  const [hospitals, setHospitals] = useState([]);
  const [pendingHospitals, setPendingHospitals] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchAdminData();
    }
  }, [user]);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      // Fetch all hospitals
      const hospitalsResponse = await axios.get(`${API}/hospitals`);
      setHospitals(hospitalsResponse.data);

      // Fetch pending hospitals
      const pendingResponse = await axios.get(`${API}/hospitals?status=pending`);
      setPendingHospitals(pendingResponse.data);

      // Fetch analytics
      const analyticsResponse = await axios.get(`${API}/stats`);
      setAnalytics(analyticsResponse.data);
      
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const verifyHospital = async (hospitalId, status) => {
    try {
      await axios.put(`${API}/hospitals/${hospitalId}/verify?status=${status}`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` }
      });
      
      alert(`Hospital ${status === 'verified' ? 'verified' : 'rejected'} successfully!`);
      fetchAdminData(); // Refresh data
    } catch (error) {
      alert(`Error: ${error.response?.data?.detail || 'Failed to update hospital status'}`);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="text-xl font-bold text-red-800 mb-2">Access Denied</h2>
          <p className="text-red-600">Admin access required to view this dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">🛠️ Admin Dashboard</h1>
        <p className="text-gray-600">Manage hospitals, verify requests, and monitor system health</p>
        
        {user?.demo && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mt-4">
            <p className="text-yellow-800 text-sm">
              <strong>Demo Admin Mode:</strong> You can explore admin features but changes won't be permanent.
            </p>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
          <span className="ml-2 text-gray-600">Loading admin dashboard...</span>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Analytics Overview */}
          {analytics && (
            <div className="bg-white shadow-lg rounded-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">📊 System Analytics</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-blue-800">Total Donors</h3>
                  <p className="text-2xl font-bold text-blue-900">{analytics.total_donors}</p>
                  <p className="text-sm text-blue-600">{analytics.online_donors} online</p>
                </div>
                <div className="bg-pink-50 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-pink-800">Active Requests</h3>
                  <p className="text-2xl font-bold text-pink-900">{analytics.total_active_requests}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-green-800">Alert Connections</h3>
                  <p className="text-2xl font-bold text-green-900">{analytics.active_alert_connections}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-purple-800">System Status</h3>
                  <p className="text-sm font-bold text-purple-900">{analytics.system_status || 'Demo Mode'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Pending Hospital Verifications */}
          <div className="bg-white shadow-lg rounded-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">🏥 Pending Hospital Verifications</h2>
            
            {pendingHospitals.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No pending hospital verifications.</p>
            ) : (
              <div className="space-y-4">
                {pendingHospitals.map((hospital) => (
                  <div key={hospital.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{hospital.name}</h3>
                        <p className="text-sm text-gray-600">License: {hospital.license_number}</p>
                      </div>
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
                        Pending
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                      <div>
                        <strong>Contact:</strong> {hospital.contact_person_name} ({hospital.contact_person_title})
                      </div>
                      <div>
                        <strong>Phone:</strong> {hospital.phone}
                      </div>
                      <div>
                        <strong>Email:</strong> {hospital.email}
                      </div>
                      <div>
                        <strong>Location:</strong> {hospital.city}, {hospital.state}
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <strong>Address:</strong> {hospital.address}
                    </div>
                    
                    <div className="flex space-x-3">
                      <button
                        onClick={() => verifyHospital(hospital.id, 'verified')}
                        className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm"
                      >
                        ✅ Verify Hospital
                      </button>
                      <button
                        onClick={() => verifyHospital(hospital.id, 'rejected')}
                        className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 text-sm"
                      >
                        ❌ Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* All Hospitals List */}
          <div className="bg-white shadow-lg rounded-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">🏥 All Hospitals</h2>
            
            {hospitals.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No hospitals registered yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Hospital
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Location
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Requests
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {hospitals.map((hospital) => (
                      <tr key={hospital.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{hospital.name}</div>
                            <div className="text-sm text-gray-500">License: {hospital.license_number}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            hospital.status === 'verified' 
                              ? 'bg-green-100 text-green-800'
                              : hospital.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {hospital.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {hospital.city}, {hospital.state}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {hospital.contact_person_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {hospital.total_requests || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;