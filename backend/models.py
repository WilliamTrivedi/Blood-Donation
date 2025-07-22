from pydantic import BaseModel, Field, validator
from typing import List, Optional
from datetime import datetime
from enum import Enum
import uuid
import secrets
import bleach
import re

# Utility functions
def generate_secure_id() -> str:
    """Generate a secure random ID"""
    return secrets.token_urlsafe(16)

def sanitize_input(text: str) -> str:
    """Sanitize user input to prevent XSS"""
    if not text:
        return ""
    # Remove HTML tags and normalize whitespace
    cleaned = bleach.clean(text.strip(), tags=[], strip=True)
    return cleaned[:500]  # Limit length

def validate_phone(phone: str) -> bool:
    """Validate phone number format"""
    if not phone:
        return False
    # Remove all non-digit characters
    digits_only = re.sub(r'[^\d]', '', phone)
    # Must have at least 10 digits and at most 15
    return 10 <= len(digits_only) <= 15

def validate_email(email: str) -> bool:
    """Validate email format"""
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(email_pattern, email)) and len(email) <= 254

def validate_blood_type(blood_type: str) -> bool:
    """Validate blood type"""
    valid_types = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
    return blood_type in valid_types

# Enums
class UserRole(str, Enum):
    DONOR = "donor"
    HOSPITAL = "hospital"
    ADMIN = "admin"
    GUEST = "guest"

class HospitalStatus(str, Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"
    SUSPENDED = "suspended"

class BloodRequestUrgency(str, Enum):
    CRITICAL = "Critical"
    URGENT = "Urgent"
    NORMAL = "Normal"

class BloodRequestStatus(str, Enum):
    ACTIVE = "Active"
    FULFILLED = "Fulfilled"
    CANCELLED = "Cancelled"
    EXPIRED = "Expired"

# Hospital Models
class Hospital(BaseModel):
    id: str = Field(default_factory=generate_secure_id)
    name: str = Field(min_length=2, max_length=200)
    license_number: str = Field(min_length=5, max_length=50)
    phone: str = Field(min_length=10, max_length=20)
    email: str = Field(min_length=5, max_length=254)
    address: str = Field(min_length=10, max_length=500)
    city: str = Field(min_length=2, max_length=100)
    state: str = Field(min_length=2, max_length=100)
    zip_code: str = Field(min_length=5, max_length=10)
    website: Optional[str] = Field(max_length=200, default=None)
    
    # Verification details
    status: HospitalStatus = HospitalStatus.PENDING
    verified_at: Optional[datetime] = None
    verified_by: Optional[str] = None  # Admin user ID
    
    # Contact person
    contact_person_name: str = Field(min_length=2, max_length=100)
    contact_person_title: str = Field(min_length=2, max_length=100)
    contact_person_phone: str = Field(min_length=10, max_length=20)
    contact_person_email: str = Field(min_length=5, max_length=254)
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True
    
    # Statistics
    total_requests: int = 0
    successful_matches: int = 0
    
    @validator('name', 'address', 'city', 'state', 'contact_person_name', 'contact_person_title')
    def sanitize_text_fields(cls, v):
        return sanitize_input(v)
    
    @validator('phone', 'contact_person_phone')
    def validate_phone_format(cls, v):
        if not validate_phone(v):
            raise ValueError('Invalid phone number format')
        return sanitize_input(v)
    
    @validator('email', 'contact_person_email')
    def validate_email_format(cls, v):
        if not validate_email(v.lower()):
            raise ValueError('Invalid email format')
        return sanitize_input(v.lower())

class HospitalCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    license_number: str = Field(min_length=5, max_length=50)
    phone: str = Field(min_length=10, max_length=20)
    email: str = Field(min_length=5, max_length=254)
    address: str = Field(min_length=10, max_length=500)
    city: str = Field(min_length=2, max_length=100)
    state: str = Field(min_length=2, max_length=100)
    zip_code: str = Field(min_length=5, max_length=10)
    website: Optional[str] = Field(max_length=200, default=None)
    contact_person_name: str = Field(min_length=2, max_length=100)
    contact_person_title: str = Field(min_length=2, max_length=100)
    contact_person_phone: str = Field(min_length=10, max_length=20)
    contact_person_email: str = Field(min_length=5, max_length=254)

# Enhanced Donor Model
class Donor(BaseModel):
    id: str = Field(default_factory=generate_secure_id)
    name: str = Field(min_length=2, max_length=100)
    phone: str = Field(min_length=10, max_length=20)
    email: str = Field(min_length=5, max_length=254)
    blood_type: str
    age: int = Field(ge=18, le=65)
    city: str = Field(min_length=2, max_length=100)
    state: str = Field(min_length=2, max_length=100)
    
    # Enhanced fields
    is_available: bool = True
    is_verified: bool = False
    last_donation: Optional[datetime] = None
    donation_count: int = 0
    
    # User account linkage
    user_id: Optional[str] = None
    
    # Real-time status
    is_online: bool = False
    last_seen: Optional[datetime] = None
    
    # Preferences
    max_distance_km: Optional[int] = Field(default=50, ge=1, le=500)
    notification_preferences: dict = Field(default_factory=lambda: {
        "email": True,
        "sms": False,
        "push": True,
        "critical_only": False
    })
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    @validator('name', 'city', 'state')
    def sanitize_text_fields(cls, v):
        return sanitize_input(v)

    @validator('phone')
    def validate_phone_format(cls, v):
        if not validate_phone(v):
            raise ValueError('Invalid phone number format')
        return sanitize_input(v)

    @validator('email')
    def validate_email_format(cls, v):
        if not validate_email(v.lower()):
            raise ValueError('Invalid email format')
        return sanitize_input(v.lower())

    @validator('blood_type')
    def validate_blood_type_format(cls, v):
        if not validate_blood_type(v):
            raise ValueError('Invalid blood type')
        return v

class DonorCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    phone: str = Field(min_length=10, max_length=20)
    email: str = Field(min_length=5, max_length=254)
    blood_type: str
    age: int = Field(ge=18, le=65)
    city: str = Field(min_length=2, max_length=100)
    state: str = Field(min_length=2, max_length=100)
    max_distance_km: Optional[int] = Field(default=50, ge=1, le=500)

    @validator('name', 'city', 'state')
    def sanitize_text_fields(cls, v):
        return sanitize_input(v)

    @validator('phone')
    def validate_phone_format(cls, v):
        if not validate_phone(v):
            raise ValueError('Invalid phone number format')
        return sanitize_input(v)

    @validator('email')
    def validate_email_format(cls, v):
        if not validate_email(v.lower()):
            raise ValueError('Invalid email format')
        return sanitize_input(v.lower())

    @validator('blood_type')
    def validate_blood_type_format(cls, v):
        if not validate_blood_type(v):
            raise ValueError('Invalid blood type')
        return v

# Enhanced Blood Request Model
class BloodRequest(BaseModel):
    id: str = Field(default_factory=generate_secure_id)
    requester_name: str = Field(min_length=2, max_length=100)
    patient_name: str = Field(min_length=2, max_length=100)
    phone: str = Field(min_length=10, max_length=20)
    email: str = Field(min_length=5, max_length=254)
    blood_type_needed: str
    urgency: BloodRequestUrgency
    units_needed: int = Field(ge=1, le=10)
    
    # Hospital information
    hospital_id: Optional[str] = None  # Links to hospital if verified
    hospital_name: str = Field(min_length=2, max_length=200)
    city: str = Field(min_length=2, max_length=100)
    state: str = Field(min_length=2, max_length=100)
    
    description: Optional[str] = Field(max_length=1000, default=None)
    status: BloodRequestStatus = BloodRequestStatus.ACTIVE
    
    # Tracking
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None
    alerts_sent: int = 0
    views_count: int = 0
    responses_count: int = 0
    
    # User account linkage
    user_id: Optional[str] = None
    
    # Priority scoring
    priority_score: float = Field(default=1.0, ge=0.0, le=10.0)

    @validator('requester_name', 'patient_name', 'city', 'state', 'hospital_name')
    def sanitize_text_fields(cls, v):
        return sanitize_input(v)

    @validator('description')
    def sanitize_description(cls, v):
        return sanitize_input(v) if v else None

    @validator('phone')
    def validate_phone_format(cls, v):
        if not validate_phone(v):
            raise ValueError('Invalid phone number format')
        return sanitize_input(v)

    @validator('email')
    def validate_email_format(cls, v):
        if not validate_email(v.lower()):
            raise ValueError('Invalid email format')
        return sanitize_input(v.lower())

    @validator('blood_type_needed')
    def validate_blood_type_format(cls, v):
        if not validate_blood_type(v):
            raise ValueError('Invalid blood type')
        return v

class BloodRequestCreate(BaseModel):
    requester_name: str = Field(min_length=2, max_length=100)
    patient_name: str = Field(min_length=2, max_length=100)
    phone: str = Field(min_length=10, max_length=20)
    email: str = Field(min_length=5, max_length=254)
    blood_type_needed: str
    urgency: BloodRequestUrgency
    units_needed: int = Field(ge=1, le=10)
    hospital_name: str = Field(min_length=2, max_length=200)
    city: str = Field(min_length=2, max_length=100)
    state: str = Field(min_length=2, max_length=100)
    description: Optional[str] = Field(max_length=1000, default=None)

    @validator('requester_name', 'patient_name', 'city', 'state', 'hospital_name')
    def sanitize_text_fields(cls, v):
        return sanitize_input(v)

    @validator('description')
    def sanitize_description(cls, v):
        return sanitize_input(v) if v else None

    @validator('phone')
    def validate_phone_format(cls, v):
        if not validate_phone(v):
            raise ValueError('Invalid phone number format')
        return sanitize_input(v)

    @validator('email')
    def validate_email_format(cls, v):
        if not validate_email(v.lower()):
            raise ValueError('Invalid email format')
        return sanitize_input(v.lower())

    @validator('blood_type_needed')
    def validate_blood_type_format(cls, v):
        if not validate_blood_type(v):
            raise ValueError('Invalid blood type')
        return v

# Alert Models
class EmergencyAlert(BaseModel):
    id: str = Field(default_factory=generate_secure_id)
    blood_request_id: str
    alert_type: str
    donors_notified: int
    hospitals_notified: int = 0
    success_rate: float = 0.0
    created_at: datetime = Field(default_factory=datetime.utcnow)

# User Models (moved from auth.py for consistency)
class User(BaseModel):
    id: str = Field(default_factory=generate_secure_id)
    email: str
    password_hash: str
    role: UserRole
    is_active: bool = True
    is_verified: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None
    
    # Role-specific data
    donor_id: Optional[str] = None
    hospital_id: Optional[str] = None

class UserCreate(BaseModel):
    email: str
    password: str
    role: UserRole = UserRole.DONOR
    donor_id: Optional[str] = None
    hospital_id: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str