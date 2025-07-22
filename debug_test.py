#!/usr/bin/env python3
"""
Debug script to test backend functionality
"""

import requests
import json

BACKEND_URL = "https://db5e780c-892a-43cc-9ec0-32f449f89e8d.preview.emergentagent.com/api"

def test_basic_endpoints():
    """Test basic endpoints"""
    print("Testing basic endpoints...")
    
    # Test API root
    try:
        response = requests.get(f"{BACKEND_URL}/", timeout=10)
        print(f"API Root: {response.status_code}")
        if response.status_code == 200:
            print(f"Response: {response.json()}")
    except Exception as e:
        print(f"API Root failed: {e}")
    
    # Test stats
    try:
        response = requests.get(f"{BACKEND_URL}/stats", timeout=10)
        print(f"Stats: {response.status_code}")
        if response.status_code == 200:
            stats = response.json()
            print(f"Total donors: {stats.get('total_donors')}")
            print(f"Total requests: {stats.get('total_active_requests')}")
    except Exception as e:
        print(f"Stats failed: {e}")

def test_demo_tokens():
    """Test demo token system"""
    print("\nTesting demo tokens...")
    
    for role in ["donor", "hospital", "admin"]:
        try:
            response = requests.get(f"{BACKEND_URL}/auth/demo-token?role={role}", timeout=10)
            print(f"Demo token {role}: {response.status_code}")
            if response.status_code == 200:
                token_data = response.json()
                print(f"  Token received: {token_data.get('demo', False)}")
        except Exception as e:
            print(f"Demo token {role} failed: {e}")

def test_phone_validation():
    """Test phone validation with different formats"""
    print("\nTesting phone validation...")
    
    phone_formats = [
        "15550123456",      # Plain digits
        "1-555-012-3456",   # With dashes
        "+1-555-012-3456",  # With country code
        "(555) 012-3456",   # With parentheses
        "555.012.3456",     # With dots
    ]
    
    for phone in phone_formats:
        donor_data = {
            "name": "Test User",
            "phone": phone,
            "email": f"test{phone.replace('+', '').replace('-', '').replace('(', '').replace(')', '').replace('.', '').replace(' ', '')}@example.com",
            "blood_type": "A+",
            "age": 25,
            "city": "Test City",
            "state": "Test State"
        }
        
        try:
            response = requests.post(f"{BACKEND_URL}/donors", json=donor_data, timeout=10)
            print(f"Phone {phone}: {response.status_code}")
            if response.status_code != 200:
                print(f"  Error: {response.text[:200]}")
        except Exception as e:
            print(f"Phone {phone} failed: {e}")

def test_user_registration():
    """Test user registration"""
    print("\nTesting user registration...")
    
    user_data = {
        "email": "testuser@example.com",
        "password": "TestPass123",
        "role": "donor"
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/auth/register", json=user_data, timeout=10)
        print(f"User registration: {response.status_code}")
        if response.status_code != 200:
            print(f"  Error: {response.text[:500]}")
        else:
            print("  Registration successful!")
    except Exception as e:
        print(f"User registration failed: {e}")

if __name__ == "__main__":
    test_basic_endpoints()
    test_demo_tokens()
    test_phone_validation()
    test_user_registration()