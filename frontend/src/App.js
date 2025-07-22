import React, { useState, useEffect, useRef } from "react";
import "./App.css";
import axios from "axios";
import LegalDisclaimer from "./components/LegalDisclaimer";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const WS_URL = BACKEND_URL.replace('https', 'wss').replace('http', 'ws');

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const URGENCY_LEVELS = ["Critical", "Urgent", "Normal"];

function App() {
  const [activeTab, setActiveTab] = useState("home");
  const [donors, setDonors] = useState([]);
  const [bloodRequests, setBloodRequests] = useState([]);
  const [stats, setStats] = useState(null);
  const [matchedDonors, setMatchedDonors] = useState(null);
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const [formErrors, setFormErrors] = useState({});

  // Form validation functions
  const validatePhone = (phone) => {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    const cleanPhone = phone.replace(/[^\d\+]/g, '');
    return phoneRegex.test(cleanPhone) && cleanPhone.length >= 10;
  };

  const validateEmail = (email) => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email) && email.length <= 254;
  };

  const validateRequired = (value, fieldName) => {
    if (!value || value.toString().trim().length === 0) {
      return `${fieldName} is required`;
    }
    return null;
  };

  const validateAge = (age) => {
    const ageNum = parseInt(age);
    if (isNaN(ageNum) || ageNum < 18 || ageNum > 65) {
      return "Age must be between 18 and 65";
    }
    return null;
  };

  const validateUnits = (units) => {
    const unitsNum = parseInt(units);
    if (isNaN(unitsNum) || unitsNum < 1 || unitsNum > 10) {
      return "Units must be between 1 and 10";
    }
    return null;
  };

  const sanitizeInput = (input) => {
    if (typeof input !== 'string') return input;
    return input.trim().slice(0, 500); // Basic length limiting
  };
  
  // Real-time alerts
  const [alerts, setAlerts] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineDonorId, setOnlineDonorId] = useState(null);
  const [notificationPermission, setNotificationPermission] = useState('default');
  const websocketRef = useRef(null);
  const audioRef = useRef(null);

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

  // Initialize WebSocket connection and audio
  useEffect(() => {
    // Request notification permission
    if ('Notification' in window) {
      Notification.requestPermission().then(permission => {
        setNotificationPermission(permission);
      });
    }

    // Create audio element for alert sounds
    audioRef.current = new Audio('data:audio/wav;base64,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8N2QQAoUXrTp66hVFAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+PxtGIcBjiS1/LIeSwFJHfH8N2QQAoUXrTp66hVFAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+PxtGIcBjiS1/LIeSwFJHfH8N2QQAoUXrTp66hVFAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+PxtGIcBjiS1/LIeSwFJHfH8N2QQAoUXrTp66hVFAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+PxtGIcBjiS1/LIeSwFJHfH8N2QQAoUXrTp66hVFAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+PxtGIcBjiS1/LIeSwFJHfH8N2QQAoUXrTp66hVFApGn+PxtGIcBjiS1/LIeSwFJHfH8N2QQAoUXrTp66hVFAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+PxtGIcBjiS1/LIeSwFJHfH8N2QQAoUXrTp66hVFAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+PxtGIcBjiS1/LIeSwFJHfH8N2QQAoUXrTp66hVFAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+PxtGIcBjiS1/LIeSwFJHfH8N2QQAoUXrTp66hVFAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+PxtGIcBjiS1/LIeSwFJHfH8N2QQAoUXrTp66hVFAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+PxtGIcBjiS1/LIeSwFJHfH8N2QQAoUXrTp66hVFAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+PxtGIcBjiS1/LIeSwFJHfH8N2QQAoUXrTp66hVFAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+PxtGIcBjiS1/LIeSwFJHfH8N2QQAoUXrTp66hVFAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+PxtGIcBjiS1/LIeSwFJHfH8N2QQAoUXrTp66hVFAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+PxtGIcBjiS1/LIeSwFJHfH8N2QQAoUXrTp66hVFAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+PxtGIcBjiS1/LIeSwFJHfH8N2QQAoUXrTp66hVFAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+PxtGIcBjiS1/LIeSwFJHfH8N2QQAoUXrTp66hVFAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+PxtGIcBjiS1/LIeSwFJHfH8N2QQAoUXrTp66hVFAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+PxtGIcBjiS1/LIeSwFJHfH8N2QQAoUXrTp66hVFAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+PxtGIcBjiS1/LIeSwFJHfH8N2QQAoUXrTp66hVFAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+PxtGIcBjiS1/LIeSwFJHfH8N2QQAoUXrTp66hVFAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+PxtGIcBjiS1/LIeSwFJHfH8N2QQAoUXrTp66hVFAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+PxtGIcBjiS1/LIeSwFJHfH8N2QQAoUXrTp66hVFAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+PxtGIcBjiS1/LIeSwFJHfH8N2QQAoUXrTp66hVFAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+PxtGIcBjiS1/LIeSwFJHfH8N2QQAoUXrTp66hVFApGn+PxtGIcBjiS1/LIeSwFJHfH8N2QQAoUXrTp66hVFAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+PxtGIcBjiS1/LIeSwFJHfH8N2QQAoUXrTp66hVFAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+PxtGIcBjiS1/LIeSwFJHfH8N2QQAoUXrTp66hVFAxQp+Pw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');
    
    connectWebSocket();

    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, []);

  const connectWebSocket = () => {
    try {
      const ws = new WebSocket(`${WS_URL}/ws`);
      websocketRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        
        // Attempt to reconnect after 3 seconds
        setTimeout(() => {
          if (!websocketRef.current || websocketRef.current.readyState === WebSocket.CLOSED) {
            connectWebSocket();
          }
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };

    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
    }
  };

  const handleWebSocketMessage = (data) => {
    console.log('WebSocket message received:', data);
    
    switch (data.type) {
      case 'welcome':
        console.log('Connected to BloodConnect alerts');
        break;
        
      case 'emergency_alert':
        handleEmergencyAlert(data);
        break;
        
      case 'general_alert':
        handleGeneralAlert(data);
        break;
        
      case 'new_donor':
        handleNewDonorAlert(data);
        break;
        
      case 'registration_success':
        console.log('Registered for emergency alerts');
        break;
        
      default:
        console.log('Unknown message type:', data.type);
    }
  };

  const handleEmergencyAlert = (data) => {
    // Add alert to list
    const newAlert = {
      id: data.alert_id,
      type: 'emergency',
      urgency: data.urgency,
      message: `🚨 EMERGENCY: ${data.blood_request.blood_type_needed} blood needed at ${data.blood_request.hospital_name}`,
      details: data.blood_request,
      timestamp: new Date().toLocaleTimeString()
    };
    
    setAlerts(prev => [newAlert, ...prev.slice(0, 9)]);
    
    // Play sound for critical alerts
    if (data.urgency === 'Critical' && audioRef.current) {
      audioRef.current.play().catch(e => console.log('Audio play failed:', e));
    }
    
    // Show browser notification
    showNotification(newAlert);
    
    // Refresh stats to show updated data
    fetchStats();
  };

  const handleGeneralAlert = (data) => {
    const newAlert = {
      id: Date.now().toString(),
      type: 'general',
      urgency: data.urgency,
      message: data.message,
      donors_alerted: data.compatible_donors_alerted,
      total_compatible: data.total_compatible_donors,
      timestamp: new Date().toLocaleTimeString()
    };
    
    setAlerts(prev => [newAlert, ...prev.slice(0, 9)]);
    
    // Show browser notification for critical alerts
    if (data.urgency === 'Critical') {
      showNotification(newAlert);
    }
  };

  const handleNewDonorAlert = (data) => {
    const newAlert = {
      id: Date.now().toString(),
      type: 'new_donor',
      message: data.message,
      blood_type: data.donor_blood_type,
      location: data.location,
      timestamp: new Date().toLocaleTimeString()
    };
    
    setAlerts(prev => [newAlert, ...prev.slice(0, 9)]);
    
    // Refresh stats to show new donor count
    fetchStats();
  };

  const showNotification = (alert) => {
    if (notificationPermission === 'granted') {
      const notification = new Notification('BloodConnect Alert', {
        body: alert.message,
        icon: '/favicon.ico',
        badge: '/favicon.ico'
      });
      
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
      
      setTimeout(() => notification.close(), 10000);
    }
  };

  const registerDonorForAlerts = (donorId) => {
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      const message = {
        type: 'register_donor',
        donor_id: donorId
      };
      websocketRef.current.send(JSON.stringify(message));
      setOnlineDonorId(donorId);
    }
  };

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
    
    // Clear previous errors
    setFormErrors({});
    const errors = {};
    
    // Validate all fields
    const nameError = validateRequired(donorForm.name, "Name");
    if (nameError) errors.name = nameError;
    
    if (!validatePhone(donorForm.phone)) {
      errors.phone = "Please enter a valid phone number (10+ digits)";
    }
    
    if (!validateEmail(donorForm.email)) {
      errors.email = "Please enter a valid email address";
    }
    
    if (!donorForm.blood_type) {
      errors.blood_type = "Please select your blood type";
    }
    
    const ageError = validateAge(donorForm.age);
    if (ageError) errors.age = ageError;
    
    const cityError = validateRequired(donorForm.city, "City");
    if (cityError) errors.city = cityError;
    
    const stateError = validateRequired(donorForm.state, "State");
    if (stateError) errors.state = stateError;
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    try {
      // Sanitize inputs
      const sanitizedForm = {
        ...donorForm,
        name: sanitizeInput(donorForm.name),
        phone: sanitizeInput(donorForm.phone),
        email: sanitizeInput(donorForm.email.toLowerCase()),
        city: sanitizeInput(donorForm.city),
        state: sanitizeInput(donorForm.state),
        age: parseInt(donorForm.age)
      };
      
      const response = await axios.post(`${API}/donors`, sanitizedForm);
      const donor = response.data;
      
      alert("✅ DEMO REGISTRATION SUCCESSFUL!\n\n⚠️ REMINDER: This is a demonstration system only.\n🚨 For real medical emergencies, call 911 immediately!");
      
      // Register for real-time alerts
      registerDonorForAlerts(donor.id);
      
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
      const errorMessage = error.response?.data?.detail || "Error registering donor. Please check your information and try again.";
      alert(`❌ Registration Failed:\n\n${errorMessage}\n\n⚠️ Remember: This is a demo system only.`);
    }
  };

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    
    // Clear previous errors
    setFormErrors({});
    const errors = {};
    
    // Validate all fields
    const requesterError = validateRequired(requestForm.requester_name, "Your Name");
    if (requesterError) errors.requester_name = requesterError;
    
    const patientError = validateRequired(requestForm.patient_name, "Patient Name");
    if (patientError) errors.patient_name = patientError;
    
    if (!validatePhone(requestForm.phone)) {
      errors.phone = "Please enter a valid phone number (10+ digits)";
    }
    
    if (!validateEmail(requestForm.email)) {
      errors.email = "Please enter a valid email address";
    }
    
    if (!requestForm.blood_type_needed) {
      errors.blood_type_needed = "Please select the blood type needed";
    }
    
    if (!requestForm.urgency) {
      errors.urgency = "Please select urgency level";
    }
    
    const unitsError = validateUnits(requestForm.units_needed);
    if (unitsError) errors.units_needed = unitsError;
    
    const hospitalError = validateRequired(requestForm.hospital_name, "Hospital Name");
    if (hospitalError) errors.hospital_name = hospitalError;
    
    const cityError = validateRequired(requestForm.city, "City");
    if (cityError) errors.city = cityError;
    
    const stateError = validateRequired(requestForm.state, "State");
    if (stateError) errors.state = stateError;
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    try {
      // Sanitize inputs
      const sanitizedForm = {
        ...requestForm,
        requester_name: sanitizeInput(requestForm.requester_name),
        patient_name: sanitizeInput(requestForm.patient_name),
        phone: sanitizeInput(requestForm.phone),
        email: sanitizeInput(requestForm.email.toLowerCase()),
        hospital_name: sanitizeInput(requestForm.hospital_name),
        city: sanitizeInput(requestForm.city),
        state: sanitizeInput(requestForm.state),
        description: sanitizeInput(requestForm.description),
        units_needed: parseInt(requestForm.units_needed)
      };
      
      await axios.post(`${API}/blood-requests`, sanitizedForm);
      
      let alertMessage = "✅ DEMO REQUEST CREATED SUCCESSFULLY!\n\n";
      if (requestForm.urgency === "Critical") {
        alertMessage += "🚨 In demo mode, this would send instant alerts with sound to all compatible donors.\n\n";
      } else if (requestForm.urgency === "Urgent") {
        alertMessage += "⚡ In demo mode, this would send instant alerts to all compatible donors.\n\n";
      } else {
        alertMessage += "📢 Normal priority request posted without emergency alerts.\n\n";
      }
      alertMessage += "⚠️ REMINDER: This is a demonstration system only.\n🚨 For real medical emergencies, call 911 immediately!";
      
      alert(alertMessage);
      
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
      const errorMessage = error.response?.data?.detail || "Error creating blood request. Please check your information and try again.";
      alert(`❌ Request Failed:\n\n${errorMessage}\n\n⚠️ Remember: This is a demo system only.`);
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

  const sendReminderAlert = async (requestId) => {
    try {
      await axios.post(`${API}/alerts/send-reminder/${requestId}`);
      alert("Reminder alert sent to compatible donors!");
    } catch (error) {
      console.error("Error sending reminder:", error);
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

  const getAlertColor = (type, urgency) => {
    if (type === 'emergency' && urgency === 'Critical') return "bg-red-50 border-red-200";
    if (type === 'emergency' && urgency === 'Urgent') return "bg-orange-50 border-orange-200";
    if (type === 'new_donor') return "bg-green-50 border-green-200";
    return "bg-blue-50 border-blue-200";
  };

  const renderFormError = (fieldName) => {
    return formErrors[fieldName] ? (
      <p className="text-red-600 text-sm mt-1">{formErrors[fieldName]}</p>
    ) : null;
  };

  const renderHome = () => (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-50">
      {/* Real-time Alert Banner */}
      {isConnected && (
        <div className="bg-green-600 text-white px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span className="text-sm">🩸 Live Emergency Alerts Active - DEMO MODE</span>
            </div>
            <div className="text-sm">
              {stats?.active_alert_connections || 0} Connected | 
              {stats?.online_donors || 0} Donors Online
            </div>
          </div>
        </div>
      )}
      
      {/* Demo Warning Banner */}
      <div className="bg-yellow-100 border-b border-yellow-300 px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-center">
          <div className="flex items-center space-x-2">
            <span className="text-yellow-800">⚠️</span>
            <span className="text-sm text-yellow-800 font-medium">
              DEMONSTRATION SYSTEM ONLY - For real medical emergencies, call 911 immediately
            </span>
          </div>
        </div>
      </div>
      
      {/* Alert Feed */}
      {alerts.length > 0 && (
        <div className="bg-white border-b px-4 py-3">
          <div className="max-w-7xl mx-auto">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">📢 Live Alerts</h3>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {alerts.slice(0, 3).map((alert) => (
                <div key={alert.id} className={`p-2 rounded border ${getAlertColor(alert.type, alert.urgency)}`}>
                  <div className="flex justify-between items-start">
                    <p className="text-sm font-medium">{alert.message}</p>
                    <span className="text-xs text-gray-500">{alert.timestamp}</span>
                  </div>
                  {alert.donors_alerted && (
                    <p className="text-xs text-gray-600 mt-1">
                      {alert.donors_alerted} donors alerted out of {alert.total_compatible} compatible
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-white">
        <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
          <div className="mx-auto grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 sm:gap-y-20 lg:mx-0 lg:max-w-none lg:grid-cols-2 lg:items-center">
            <div className="lg:pr-8">
              <div className="lg:max-w-lg">
                <p className="text-base font-semibold leading-7 text-red-600">Save Lives Instantly</p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                  Real-time Blood Donation Emergency Network
                </h1>
                <p className="mt-6 text-lg leading-8 text-gray-600">
                  Join our nationwide network with instant emergency alerts. When critical blood is needed, 
                  all compatible donors are notified immediately. Every second counts in saving lives.
                </p>
                <div className="mt-8 flex gap-4">
                  <button
                    onClick={() => setActiveTab("register-donor")}
                    className="rounded-md bg-red-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-red-500 flex items-center space-x-2"
                  >
                    <span>🚨</span>
                    <span>Get Emergency Alerts</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("request-blood")}
                    className="rounded-md bg-pink-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-pink-500 flex items-center space-x-2"
                  >
                    <span>📢</span>
                    <span>Request Blood Now</span>
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

      {/* Enhanced Stats Section */}
      {stats && (
        <div className="bg-white py-16">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Real-time Network Status
              </h2>
              <p className="mt-4 text-lg leading-8 text-gray-600">
                Live data from our emergency blood donation network
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
                <p className="text-sm text-gray-600">Total Donors</p>
                <p className="text-xs text-green-600">
                  {stats.online_donors} online now
                </p>
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
                <div className="mx-auto h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center">
                  <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5-5-5h5v-5a7.5 7.5 0 01-7.5-7.5H2.5v-2h5A7.5 7.5 0 0115 12v5z" />
                  </svg>
                </div>
                <h3 className="mt-4 text-2xl font-bold text-gray-900">{stats.active_alert_connections}</h3>
                <p className="text-sm text-gray-600">Alert Connections</p>
                <p className="text-xs text-green-600">
                  {isConnected ? "You're connected" : "Connecting..."}
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="mt-4 text-2xl font-bold text-gray-900">⚡</h3>
                <p className="text-sm text-gray-600">Instant Alerts</p>
                <p className="text-xs text-green-600">Real-time</p>
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
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">🚨 Register for Emergency Blood Alerts</h2>
          <p className="text-gray-600 mt-2">
            Get instant notifications when your blood type is urgently needed
          </p>
          <div className="bg-red-50 border border-red-200 rounded-md p-3 mt-3">
            <p className="text-red-700 text-sm font-medium">
              ⚠️ DEMO MODE: This registration is for demonstration purposes only
            </p>
          </div>
          <div className="flex items-center justify-center mt-3 space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-600">
              {isConnected ? 'Real-time alerts active (DEMO)' : 'Connecting to alert system...'}
            </span>
          </div>
        </div>
        
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
          
          {/* Notification Permission */}
          {notificationPermission !== 'granted' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <div className="flex">
                <svg className="h-5 w-5 text-yellow-400 mt-0.5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 15.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div>
                  <h3 className="text-sm font-medium text-yellow-800">Enable Browser Notifications</h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    Allow notifications to receive instant emergency alerts when your blood type is urgently needed.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <button
            type="submit"
            className="w-full bg-red-600 text-white py-3 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 font-semibold"
          >
            🚨 Register for Emergency Alerts
          </button>
        </form>
      </div>
    </div>
  );

  const renderBloodRequest = () => (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white shadow-xl rounded-lg p-8">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">📢 Request Blood - Instant Donor Alerts</h2>
          <p className="text-gray-600 mt-2">
            All compatible donors will be instantly notified of your request
          </p>
        </div>
        
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
                <option value="Critical">🚨 Critical (Instant alerts + sound)</option>
                <option value="Urgent">⚡ Urgent (Instant alerts)</option>
                <option value="Normal">📢 Normal (No alerts)</option>
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
              placeholder="Brief description of the medical situation..."
            />
          </div>
          
          {/* Alert Preview */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex items-start">
              <svg className="h-5 w-5 text-blue-400 mt-0.5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-blue-800">Real-time Alert System</h3>
                <p className="text-sm text-blue-700 mt-1">
                  {requestForm.urgency === "Critical" && "🚨 CRITICAL requests send instant alerts with sound to all compatible donors"}
                  {requestForm.urgency === "Urgent" && "⚡ URGENT requests send instant alerts to all compatible donors"}
                  {requestForm.urgency === "Normal" && "📢 NORMAL requests are posted without emergency alerts"}
                  {!requestForm.urgency && "Select urgency level to see alert behavior"}
                </p>
              </div>
            </div>
          </div>
          
          <button
            type="submit"
            className="w-full bg-pink-600 text-white py-3 px-4 rounded-md hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 font-semibold"
          >
            📢 Submit Blood Request & Alert Donors
          </button>
        </form>
      </div>
    </div>
  );

  const renderBloodRequests = () => (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white shadow-xl rounded-lg p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Active Blood Requests with Real-time Matching</h2>
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
                    {request.urgency === 'Critical' && '🚨'} 
                    {request.urgency === 'Urgent' && '⚡'} 
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
                  <div className="space-x-2">
                    <button
                      onClick={() => findMatches(request.id)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                    >
                      Find Matching Donors
                    </button>
                    {(request.urgency === 'Critical' || request.urgency === 'Urgent') && (
                      <button
                        onClick={() => sendReminderAlert(request.id)}
                        className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700"
                      >
                        🔔 Send Reminder Alert
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Enhanced Matched Donors Modal */}
        {matchedDonors && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-4xl max-h-96 overflow-y-auto p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-xl font-bold">
                    Matching Donors ({matchedDonors.total_matches})
                  </h3>
                  <p className="text-sm text-gray-600">
                    {matchedDonors.online_donors} donors currently online for instant contact
                  </p>
                </div>
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
                    <div key={index} className={`border rounded p-4 ${match.is_online ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold flex items-center space-x-2">
                            <span>{match.donor.name}</span>
                            {match.is_online && (
                              <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                                🟢 Online Now
                              </span>
                            )}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {match.donor.blood_type} • {match.donor.city}, {match.donor.state}
                          </p>
                          <p className="text-sm text-gray-600">
                            Age: {match.donor.age} • Contact: {match.donor.phone}
                          </p>
                          <p className="text-sm text-blue-600">
                            Email: {match.donor.email}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-1 rounded text-sm ${
                            match.compatibility === 'Direct' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {match.compatibility}
                          </span>
                          {match.location_match === 2 && (
                            <span className="block text-xs text-green-600 mt-1">📍 Same City</span>
                          )}
                          {match.location_match === 1 && (
                            <span className="block text-xs text-blue-600 mt-1">📍 Same State</span>
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
              <div key={donor.id} className={`border rounded-lg p-4 hover:shadow-md ${donor.is_online ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-gray-900">{donor.name}</h3>
                  {donor.is_online && (
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                      🟢 Online
                    </span>
                  )}
                </div>
                <p className="text-red-600 font-bold text-lg">{donor.blood_type}</p>
                <p className="text-sm text-gray-600">{donor.city}, {donor.state}</p>
                <p className="text-sm text-gray-600">Age: {donor.age}</p>
                <div className="mt-2">
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                    Available
                  </span>
                  {donor.is_online && (
                    <span className="ml-2 text-xs text-green-600">
                      Receiving alerts
                    </span>
                  )}
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
      {/* Legal Disclaimer Modal */}
      <LegalDisclaimer 
        show={showDisclaimer} 
        onAccept={() => setShowDisclaimer(false)} 
      />
      
      {/* Navigation */}
      <nav className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold">🩸</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">BloodConnect</h1>
              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">DEMO</span>
              <div className="flex items-center space-x-2">
                {isConnected ? (
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-green-600">Live</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-xs text-red-600">Offline</span>
                  </div>
                )}
              </div>
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
                🚨 Get Alerts
              </button>
              <button
                onClick={() => setActiveTab("request-blood")}
                className={`px-4 py-2 rounded-md ${activeTab === "request-blood" ? "bg-red-600 text-white" : "text-gray-600 hover:text-red-600"}`}
              >
                📢 Request Blood
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