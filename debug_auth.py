#!/usr/bin/env python3
"""
Simple test to debug the auth registration issue
"""

import requests
import json

BACKEND_URL = "https://77b2b468-40b4-4042-a5a6-f3da0cc2b196.preview.emergentagent.com/api"

def test_simple_registration():
    """Test simple user registration"""
    user_data = {
        "email": "test@example.com",
        "password": "TestPass123",
        "role": "donor"
    }
    
    try:
        print(f"Testing registration at: {BACKEND_URL}/auth/register")
        print(f"Data: {json.dumps(user_data, indent=2)}")
        
        response = requests.post(f"{BACKEND_URL}/auth/register", json=user_data, timeout=10)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        print(f"Response Text: {response.text}")
        
        if response.status_code == 200:
            print("✅ Registration successful!")
            return True
        else:
            print(f"❌ Registration failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Request failed: {str(e)}")
        return False

def test_api_root():
    """Test API root endpoint"""
    try:
        response = requests.get(f"{BACKEND_URL}/", timeout=10)
        print(f"API Root Status: {response.status_code}")
        if response.status_code == 200:
            print(f"API Root Response: {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"API Root failed: {str(e)}")
        return False

def test_demo_token():
    """Test demo token endpoint"""
    try:
        response = requests.get(f"{BACKEND_URL}/auth/demo-token?role=donor", timeout=10)
        print(f"Demo Token Status: {response.status_code}")
        if response.status_code == 200:
            print(f"Demo Token Response: {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"Demo Token failed: {str(e)}")
        return False

if __name__ == "__main__":
    print("🔍 DEBUGGING AUTH REGISTRATION ISSUE")
    print("=" * 50)
    
    print("\n1. Testing API Root...")
    test_api_root()
    
    print("\n2. Testing Demo Token...")
    test_demo_token()
    
    print("\n3. Testing User Registration...")
    test_simple_registration()