#!/usr/bin/env python3
"""
Real-time Emergency Alert System Testing for Blood Donation App
Tests WebSocket connections, emergency alerts, online status tracking, and enhanced features
"""

import asyncio
import websockets
import requests
import json
import sys
from datetime import datetime
import time
import threading
from concurrent.futures import ThreadPoolExecutor

# Get backend URL from frontend .env
BACKEND_URL = "https://db5e780c-892a-43cc-9ec0-32f449f89e8d.preview.emergentagent.com"
API_URL = f"{BACKEND_URL}/api"
WS_URL = BACKEND_URL.replace("https://", "wss://") + "/ws"

class RealTimeAlertTester:
    def __init__(self):
        self.api_url = API_URL
        self.ws_url = WS_URL
        self.test_results = []
        self.websocket_messages = []
        self.created_donors = []
        self.created_requests = []
        self.websocket_connections = []
        
    def log_test(self, test_name, success, message, details=None):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if details and not success:
            print(f"   Details: {details}")
    
    async def test_websocket_connection(self):
        """Test WebSocket connection establishment"""
        try:
            print(f"Attempting to connect to WebSocket: {self.ws_url}")
            
            async with websockets.connect(self.ws_url, timeout=10) as websocket:
                self.log_test("WebSocket Connection", True, "Successfully connected to WebSocket endpoint")
                
                # Wait for welcome message
                try:
                    welcome_msg = await asyncio.wait_for(websocket.recv(), timeout=5)
                    welcome_data = json.loads(welcome_msg)
                    
                    if welcome_data.get("type") == "welcome":
                        self.log_test("WebSocket Welcome Message", True, "Received welcome message from server")
                        return True
                    else:
                        self.log_test("WebSocket Welcome Message", False, f"Unexpected message type: {welcome_data.get('type')}")
                        return False
                        
                except asyncio.TimeoutError:
                    self.log_test("WebSocket Welcome Message", False, "No welcome message received within timeout")
                    return False
                    
        except Exception as e:
            self.log_test("WebSocket Connection", False, f"Failed to connect: {str(e)}")
            return False
    
    async def test_donor_registration_with_websocket(self):
        """Test donor registration and WebSocket registration"""
        try:
            # First register a donor via API
            donor_data = {
                "name": "Emma Wilson",
                "phone": "+1-555-0400",
                "email": "emma.wilson@email.com",
                "blood_type": "O-",
                "age": 30,
                "city": "Boston",
                "state": "Massachusetts"
            }
            
            response = requests.post(f"{self.api_url}/donors", json=donor_data, timeout=10)
            if response.status_code != 200:
                self.log_test("Donor Registration for WebSocket", False, f"Failed to register donor: {response.status_code}")
                return False
            
            donor = response.json()
            self.created_donors.append(donor)
            donor_id = donor["id"]
            
            # Connect to WebSocket and register donor
            async with websockets.connect(self.ws_url, timeout=10) as websocket:
                # Send donor registration message
                register_msg = {
                    "type": "register_donor",
                    "donor_id": donor_id
                }
                await websocket.send(json.dumps(register_msg))
                
                # Wait for registration confirmation
                try:
                    response_msg = await asyncio.wait_for(websocket.recv(), timeout=5)
                    response_data = json.loads(response_msg)
                    
                    if response_data.get("type") == "registration_success":
                        self.log_test("WebSocket Donor Registration", True, f"Successfully registered donor {donor['name']} for alerts")
                        return True
                    else:
                        self.log_test("WebSocket Donor Registration", False, f"Unexpected response: {response_data}")
                        return False
                        
                except asyncio.TimeoutError:
                    self.log_test("WebSocket Donor Registration", False, "No registration confirmation received")
                    return False
                    
        except Exception as e:
            self.log_test("WebSocket Donor Registration", False, f"Registration failed: {str(e)}")
            return False
    
    async def test_emergency_alert_system(self):
        """Test emergency alert system for Critical/Urgent requests"""
        try:
            # Set up WebSocket listener
            messages_received = []
            
            async def websocket_listener():
                try:
                    async with websockets.connect(self.ws_url, timeout=10) as websocket:
                        # Register as a donor if we have one
                        if self.created_donors:
                            register_msg = {
                                "type": "register_donor",
                                "donor_id": self.created_donors[0]["id"]
                            }
                            await websocket.send(json.dumps(register_msg))
                        
                        # Listen for messages for 15 seconds
                        start_time = time.time()
                        while time.time() - start_time < 15:
                            try:
                                message = await asyncio.wait_for(websocket.recv(), timeout=2)
                                data = json.loads(message)
                                messages_received.append(data)
                                print(f"📨 Received WebSocket message: {data.get('type', 'unknown')}")
                            except asyncio.TimeoutError:
                                continue
                            except Exception as e:
                                print(f"Error receiving message: {e}")
                                break
                                
                except Exception as e:
                    print(f"WebSocket listener error: {e}")
            
            # Start WebSocket listener in background
            listener_task = asyncio.create_task(websocket_listener())
            
            # Wait a moment for connection
            await asyncio.sleep(2)
            
            # Create a CRITICAL blood request
            critical_request = {
                "requester_name": "Dr. Emergency Response",
                "patient_name": "Critical Patient Alpha",
                "phone": "+1-555-0500",
                "email": "emergency@hospital.com",
                "blood_type_needed": "O-",
                "urgency": "Critical",
                "units_needed": 4,
                "hospital_name": "Emergency Medical Center",
                "city": "Boston",
                "state": "Massachusetts",
                "description": "Emergency trauma patient needs immediate O- blood"
            }
            
            response = requests.post(f"{self.api_url}/blood-requests", json=critical_request, timeout=10)
            if response.status_code != 200:
                self.log_test("Critical Request Creation", False, f"Failed to create critical request: {response.status_code}")
                return False
            
            blood_request = response.json()
            self.created_requests.append(blood_request)
            
            # Wait for alerts to be sent
            await asyncio.sleep(3)
            
            # Create an URGENT blood request
            urgent_request = {
                "requester_name": "Dr. Urgent Care",
                "patient_name": "Urgent Patient Beta",
                "phone": "+1-555-0501",
                "email": "urgent@hospital.com",
                "blood_type_needed": "A+",
                "urgency": "Urgent",
                "units_needed": 2,
                "hospital_name": "City General Hospital",
                "city": "Boston",
                "state": "Massachusetts"
            }
            
            response = requests.post(f"{self.api_url}/blood-requests", json=urgent_request, timeout=10)
            if response.status_code == 200:
                urgent_blood_request = response.json()
                self.created_requests.append(urgent_blood_request)
            
            # Wait for more alerts
            await asyncio.sleep(3)
            
            # Create a NORMAL request (should NOT trigger alerts)
            normal_request = {
                "requester_name": "Dr. Routine",
                "patient_name": "Normal Patient Gamma",
                "phone": "+1-555-0502",
                "email": "routine@hospital.com",
                "blood_type_needed": "B+",
                "urgency": "Normal",
                "units_needed": 1,
                "hospital_name": "Community Hospital",
                "city": "Boston",
                "state": "Massachusetts"
            }
            
            response = requests.post(f"{self.api_url}/blood-requests", json=normal_request, timeout=10)
            if response.status_code == 200:
                normal_blood_request = response.json()
                self.created_requests.append(normal_blood_request)
            
            # Wait for final messages
            await asyncio.sleep(5)
            
            # Cancel the listener
            listener_task.cancel()
            
            # Analyze received messages
            emergency_alerts = [msg for msg in messages_received if msg.get("type") == "emergency_alert"]
            general_alerts = [msg for msg in messages_received if msg.get("type") == "general_alert"]
            
            if emergency_alerts:
                self.log_test("Emergency Alert System", True, f"Received {len(emergency_alerts)} emergency alerts for Critical/Urgent requests")
            else:
                self.log_test("Emergency Alert System", False, "No emergency alerts received for Critical/Urgent requests")
                return False
            
            # Check that alerts contain proper information
            for alert in emergency_alerts:
                if "urgency" in alert and "blood_request" in alert:
                    self.log_test("Alert Content Structure", True, "Emergency alerts contain required fields")
                else:
                    self.log_test("Alert Content Structure", False, "Emergency alerts missing required fields")
                    return False
            
            # Verify no alerts for Normal requests
            normal_alerts = [alert for alert in emergency_alerts if alert.get("urgency") == "Normal"]
            if not normal_alerts:
                self.log_test("Normal Request Alert Filtering", True, "No alerts sent for Normal urgency requests")
            else:
                self.log_test("Normal Request Alert Filtering", False, "Alerts incorrectly sent for Normal requests")
            
            return True
            
        except Exception as e:
            self.log_test("Emergency Alert System", False, f"Alert system test failed: {str(e)}")
            return False
    
    def test_enhanced_statistics(self):
        """Test enhanced statistics with online donor counts"""
        try:
            response = requests.get(f"{self.api_url}/stats", timeout=10)
            if response.status_code != 200:
                self.log_test("Enhanced Statistics API", False, f"Failed to get stats: {response.status_code}")
                return False
            
            stats = response.json()
            
            # Check for new fields
            required_new_fields = ["online_donors", "active_alert_connections"]
            missing_fields = [field for field in required_new_fields if field not in stats]
            
            if missing_fields:
                self.log_test("Enhanced Statistics Fields", False, f"Missing new fields: {missing_fields}")
                return False
            else:
                self.log_test("Enhanced Statistics Fields", True, "All new statistics fields present")
            
            # Check blood type breakdown has online_donors
            blood_type_breakdown = stats.get("blood_type_breakdown", {})
            if blood_type_breakdown:
                sample_type = list(blood_type_breakdown.keys())[0]
                sample_data = blood_type_breakdown[sample_type]
                
                if "online_donors" in sample_data:
                    self.log_test("Blood Type Online Donors", True, "Blood type breakdown includes online donor counts")
                else:
                    self.log_test("Blood Type Online Donors", False, "Blood type breakdown missing online donor counts")
                    return False
            
            # Verify data types and ranges
            online_donors = stats.get("online_donors", 0)
            total_donors = stats.get("total_donors", 0)
            active_connections = stats.get("active_alert_connections", 0)
            
            if isinstance(online_donors, int) and online_donors >= 0:
                self.log_test("Online Donors Count", True, f"Online donors count is valid: {online_donors}")
            else:
                self.log_test("Online Donors Count", False, f"Invalid online donors count: {online_donors}")
                return False
            
            if online_donors <= total_donors:
                self.log_test("Online vs Total Donors Logic", True, "Online donors <= total donors (logical)")
            else:
                self.log_test("Online vs Total Donors Logic", False, f"Online donors ({online_donors}) > total donors ({total_donors})")
            
            return True
            
        except Exception as e:
            self.log_test("Enhanced Statistics", False, f"Statistics test failed: {str(e)}")
            return False
    
    def test_enhanced_matching_with_online_status(self):
        """Test that matching now includes online status information"""
        if not self.created_requests:
            self.log_test("Enhanced Matching Test", False, "No blood requests available for matching test")
            return False
        
        try:
            request_id = self.created_requests[0]["id"]
            response = requests.get(f"{self.api_url}/match-donors/{request_id}", timeout=10)
            
            if response.status_code != 200:
                self.log_test("Enhanced Matching API", False, f"Failed to get matches: {response.status_code}")
                return False
            
            match_result = response.json()
            
            # Check for new fields in response
            if "online_donors" in match_result:
                self.log_test("Matching Online Donors Count", True, "Match response includes online donors count")
            else:
                self.log_test("Matching Online Donors Count", False, "Match response missing online donors count")
                return False
            
            # Check that individual donor matches include online status
            compatible_donors = match_result.get("compatible_donors", [])
            if compatible_donors:
                sample_donor = compatible_donors[0]
                if "is_online" in sample_donor:
                    self.log_test("Donor Online Status in Matching", True, "Individual donor matches include online status")
                else:
                    self.log_test("Donor Online Status in Matching", False, "Individual donor matches missing online status")
                    return False
            
            return True
            
        except Exception as e:
            self.log_test("Enhanced Matching", False, f"Enhanced matching test failed: {str(e)}")
            return False
    
    def test_alert_management_endpoints(self):
        """Test alert management endpoints"""
        try:
            # Test recent alerts endpoint
            response = requests.get(f"{self.api_url}/alerts/recent", timeout=10)
            if response.status_code != 200:
                self.log_test("Recent Alerts Endpoint", False, f"Failed to get recent alerts: {response.status_code}")
                return False
            
            alerts = response.json()
            self.log_test("Recent Alerts Endpoint", True, f"Retrieved {len(alerts)} recent alerts")
            
            # Test reminder alert endpoint if we have requests
            if self.created_requests:
                request_id = self.created_requests[0]["id"]
                response = requests.post(f"{self.api_url}/alerts/send-reminder/{request_id}", timeout=10)
                
                if response.status_code == 200:
                    self.log_test("Send Reminder Alert", True, "Successfully sent reminder alert")
                else:
                    self.log_test("Send Reminder Alert", False, f"Failed to send reminder: {response.status_code}")
                    return False
            
            return True
            
        except Exception as e:
            self.log_test("Alert Management Endpoints", False, f"Alert management test failed: {str(e)}")
            return False
    
    async def test_websocket_message_handling(self):
        """Test various WebSocket message types"""
        try:
            async with websockets.connect(self.ws_url, timeout=10) as websocket:
                # Test invalid JSON message
                await websocket.send("invalid json")
                
                try:
                    error_response = await asyncio.wait_for(websocket.recv(), timeout=5)
                    error_data = json.loads(error_response)
                    
                    if error_data.get("type") == "error":
                        self.log_test("WebSocket Error Handling", True, "Server properly handles invalid JSON")
                    else:
                        self.log_test("WebSocket Error Handling", False, "Server did not send error for invalid JSON")
                        return False
                        
                except asyncio.TimeoutError:
                    self.log_test("WebSocket Error Handling", False, "No error response received for invalid JSON")
                    return False
                
                # Test valid message handling
                if self.created_donors:
                    register_msg = {
                        "type": "register_donor",
                        "donor_id": self.created_donors[0]["id"]
                    }
                    await websocket.send(json.dumps(register_msg))
                    
                    try:
                        success_response = await asyncio.wait_for(websocket.recv(), timeout=5)
                        success_data = json.loads(success_response)
                        
                        if success_data.get("type") == "registration_success":
                            self.log_test("WebSocket Message Processing", True, "Server properly processes valid messages")
                        else:
                            self.log_test("WebSocket Message Processing", False, "Server did not confirm valid message")
                            return False
                            
                    except asyncio.TimeoutError:
                        self.log_test("WebSocket Message Processing", False, "No confirmation for valid message")
                        return False
                
                return True
                
        except Exception as e:
            self.log_test("WebSocket Message Handling", False, f"Message handling test failed: {str(e)}")
            return False
    
    async def test_connection_management(self):
        """Test WebSocket connection management"""
        try:
            # Test multiple connections
            connections = []
            
            for i in range(3):
                try:
                    websocket = await websockets.connect(self.ws_url, timeout=10)
                    connections.append(websocket)
                    await asyncio.sleep(0.5)
                except Exception as e:
                    self.log_test("Multiple WebSocket Connections", False, f"Failed to create connection {i+1}: {e}")
                    return False
            
            self.log_test("Multiple WebSocket Connections", True, f"Successfully created {len(connections)} connections")
            
            # Close connections gracefully
            for websocket in connections:
                await websocket.close()
            
            self.log_test("WebSocket Connection Cleanup", True, "Successfully closed all connections")
            return True
            
        except Exception as e:
            self.log_test("Connection Management", False, f"Connection management test failed: {str(e)}")
            return False
    
    async def run_all_tests(self):
        """Run all real-time alert tests"""
        print("🚨 BLOOD DONATION APP - REAL-TIME EMERGENCY ALERT TESTING")
        print("=" * 70)
        
        # Test sequence
        tests = [
            ("WebSocket Connection", self.test_websocket_connection()),
            ("Donor Registration with WebSocket", self.test_donor_registration_with_websocket()),
            ("Emergency Alert System", self.test_emergency_alert_system()),
            ("Enhanced Statistics", lambda: self.test_enhanced_statistics()),
            ("Enhanced Matching with Online Status", lambda: self.test_enhanced_matching_with_online_status()),
            ("Alert Management Endpoints", lambda: self.test_alert_management_endpoints()),
            ("WebSocket Message Handling", self.test_websocket_message_handling()),
            ("Connection Management", self.test_connection_management()),
        ]
        
        passed = 0
        failed = 0
        
        for test_name, test_func in tests:
            print(f"\n--- {test_name} ---")
            try:
                if asyncio.iscoroutine(test_func) or asyncio.iscoroutinefunction(test_func):
                    result = await test_func
                else:
                    result = test_func()
                
                if result:
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                print(f"❌ FAIL: {test_name} - Exception: {str(e)}")
                failed += 1
            
            await asyncio.sleep(1)  # Brief pause between tests
        
        # Summary
        print("\n" + "=" * 70)
        print("🚨 REAL-TIME EMERGENCY ALERT TEST SUMMARY")
        print("=" * 70)
        print(f"✅ PASSED: {passed}")
        print(f"❌ FAILED: {failed}")
        print(f"📊 SUCCESS RATE: {(passed/(passed+failed)*100):.1f}%")
        
        if failed == 0:
            print("\n🎉 ALL REAL-TIME TESTS PASSED! Emergency alert system is fully operational.")
        else:
            print(f"\n⚠️  {failed} tests failed. Check the details above.")
        
        return failed == 0

async def main():
    """Main test execution"""
    tester = RealTimeAlertTester()
    success = await tester.run_all_tests()
    
    if success:
        print("\n✅ REAL-TIME ALERT TESTING COMPLETE - ALL SYSTEMS OPERATIONAL")
        return True
    else:
        print("\n❌ REAL-TIME ALERT TESTING COMPLETE - ISSUES FOUND")
        return False

if __name__ == "__main__":
    result = asyncio.run(main())
    sys.exit(0 if result else 1)