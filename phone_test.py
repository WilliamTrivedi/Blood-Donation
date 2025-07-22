#!/usr/bin/env python3
"""
Quick test to debug phone validation issues
"""

import re
import bleach

def validate_phone(phone: str) -> bool:
    """Validate phone number format - allow common phone formats"""
    if not phone:
        return False
    # Remove all non-digit characters
    digits_only = re.sub(r'[^\d]', '', phone)
    print(f"Phone: '{phone}' -> Digits only: '{digits_only}' -> Length: {len(digits_only)}")
    # Must have at least 10 digits and at most 15
    return 10 <= len(digits_only) <= 15

def sanitize_input(text: str) -> str:
    """Sanitize user input to prevent XSS"""
    if not text:
        return ""
    # Remove HTML tags and normalize whitespace
    cleaned = bleach.clean(text.strip(), tags=[], strip=True)
    print(f"Sanitize: '{text}' -> '{cleaned}'")
    return cleaned[:500]  # Limit length

# Test phone numbers from the test
test_phones = [
    "+1-555-0100",
    "+1-555-0101", 
    "+1-555-0300",
    "+1-555-0400",
    "555-123-4567",
    "+1-555-012-3456"
]

print("Testing phone validation:")
for phone in test_phones:
    print(f"\n--- Testing: {phone} ---")
    is_valid = validate_phone(phone)
    sanitized = sanitize_input(phone)
    print(f"Valid: {is_valid}, Sanitized: '{sanitized}'")
    
    # Test if sanitized version is still valid
    if is_valid:
        sanitized_valid = validate_phone(sanitized)
        print(f"Sanitized still valid: {sanitized_valid}")