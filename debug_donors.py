#!/usr/bin/env python3
"""
Debug donor registration issue
"""

import requests
import json

BACKEND_URL = "https://77b2b468-40b4-4042-a5a6-f3da0cc2b196.preview.emergentagent.com/api"

def test_donor_registration():
    """Test donor registration"""
    donor_data = {
        "name": "Test Donor",
        "phone": "+1-617-555-1001",
        "email": "test.donor@email.com",
        "blood_type": "O-",
        "age": 32,
        "city": "Boston",
        "state": "Massachusetts"
    }
    
    try:
        print(f"Testing donor registration at: {BACKEND_URL}/donors")
        print(f"Data: {json.dumps(donor_data, indent=2)}")
        
        response = requests.post(f"{BACKEND_URL}/donors", json=donor_data, timeout=10)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response Text: {response.text}")
        
        if response.status_code == 200:
            print("✅ Donor registration successful!")
            return response.json()
        else:
            print(f"❌ Donor registration failed with status {response.status_code}")
            return None
            
    except Exception as e:
        print(f"❌ Request failed: {str(e)}")
        return None

def test_get_donors():
    """Test getting donors list"""
    try:
        response = requests.get(f"{BACKEND_URL}/donors", timeout=10)
        print(f"Get Donors Status: {response.status_code}")
        if response.status_code == 200:
            donors = response.json()
            print(f"Found {len(donors)} donors")
            return donors
        else:
            print(f"Get donors failed: {response.text}")
            return None
    except Exception as e:
        print(f"Get donors failed: {str(e)}")
        return None

def test_get_blood_requests():
    """Test getting blood requests list"""
    try:
        response = requests.get(f"{BACKEND_URL}/blood-requests", timeout=10)
        print(f"Get Blood Requests Status: {response.status_code}")
        if response.status_code == 200:
            requests_list = response.json()
            print(f"Found {len(requests_list)} blood requests")
            return requests_list
        else:
            print(f"Get blood requests failed: {response.text}")
            return None
    except Exception as e:
        print(f"Get blood requests failed: {str(e)}")
        return None

if __name__ == "__main__":
    print("🔍 DEBUGGING DONOR AND BLOOD REQUEST ISSUES")
    print("=" * 60)
    
    print("\n1. Testing Donor Registration...")
    donor = test_donor_registration()
    
    print("\n2. Testing Get Donors...")
    donors = test_get_donors()
    
    print("\n3. Testing Get Blood Requests...")
    requests_list = test_get_blood_requests()
    
    if donor and requests_list:
        print(f"\n4. Testing Donor Matching...")
        if len(requests_list) > 0:
            request_id = requests_list[0]["id"]
            try:
                response = requests.get(f"{BACKEND_URL}/match-donors/{request_id}", timeout=10)
                print(f"Matching Status: {response.status_code}")
                if response.status_code == 200:
                    match_result = response.json()
                    print(f"Found {match_result.get('total_matches', 0)} matches")
                else:
                    print(f"Matching failed: {response.text}")
            except Exception as e:
                print(f"Matching failed: {str(e)}")