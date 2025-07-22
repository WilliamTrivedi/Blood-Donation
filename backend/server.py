from fastapi import FastAPI, APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, validator
from typing import List, Optional
import uuid
from datetime import datetime
import json
import asyncio
import re
import bleach
import hashlib
import secrets


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security configuration
security = HTTPBearer(auto_error=False)
limiter = Limiter(key_func=get_remote_address)

# Create the main app without a prefix
app = FastAPI(
    title="BloodConnect Emergency Response System",
    description="Real-time blood donation emergency network - FOR DEMONSTRATION PURPOSES ONLY",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Security middleware
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["*"])
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(SlowAPIMiddleware)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Input validation and sanitization functions
def validate_phone(phone: str) -> bool:
    """Validate phone number format"""
    phone_pattern = r'^[\+]?[1-9][\d]{0,15}$'
    clean_phone = re.sub(r'[^\d\+]', '', phone)
    return bool(re.match(phone_pattern, clean_phone)) and len(clean_phone) >= 10

def validate_email(email: str) -> bool:
    """Validate email format"""
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(email_pattern, email)) and len(email) <= 254

def sanitize_input(text: str) -> str:
    """Sanitize user input to prevent XSS"""
    if not text:
        return ""
    # Remove HTML tags and normalize whitespace
    cleaned = bleach.clean(text.strip(), tags=[], strip=True)
    return cleaned[:500]  # Limit length

def validate_blood_type(blood_type: str) -> bool:
    """Validate blood type"""
    valid_types = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
    return blood_type in valid_types

def generate_secure_id() -> str:
    """Generate a secure random ID"""
    return secrets.token_urlsafe(16)

# WebSocket connection manager for real-time alerts
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.donor_connections: dict = {}  # donor_id: websocket
        self.connection_tokens: dict = {}  # websocket: token for basic security

    async def connect(self, websocket: WebSocket, donor_id: str = None):
        await websocket.accept()
        # Generate a simple token for this connection
        connection_token = secrets.token_urlsafe(16)
        self.connection_tokens[websocket] = connection_token
        self.active_connections.append(websocket)
        if donor_id:
            self.donor_connections[donor_id] = websocket
        print(f"WebSocket connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket, donor_id: str = None):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if websocket in self.connection_tokens:
            del self.connection_tokens[websocket]
        if donor_id and donor_id in self.donor_connections:
            del self.donor_connections[donor_id]
        print(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")

    async def send_personal_message(self, message: str, websocket: WebSocket):
        try:
            await websocket.send_text(message)
        except Exception as e:
            print(f"Error sending personal message: {e}")

    async def send_to_donor(self, message: str, donor_id: str):
        if donor_id in self.donor_connections:
            try:
                await self.donor_connections[donor_id].send_text(message)
            except Exception as e:
                print(f"Error sending to donor {donor_id}: {e}")

    async def broadcast_alert(self, message: str):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                print(f"Error broadcasting to connection: {e}")
                disconnected.append(connection)
        
        # Remove disconnected connections
        for conn in disconnected:
            if conn in self.active_connections:
                self.active_connections.remove(conn)

    async def notify_compatible_donors(self, blood_request: dict):
        """Send emergency alerts to compatible donors"""
        try:
            # Find compatible donors
            all_donors = await db.donors.find({"is_available": True}).to_list(1000)
            compatible_donors = []
            
            for donor_data in all_donors:
                if self.calculate_compatibility(donor_data["blood_type"], blood_request["blood_type_needed"]):
                    # Calculate location priority
                    location_match = 0
                    if donor_data["city"].lower() == blood_request["city"].lower():
                        location_match = 2
                    elif donor_data["state"].lower() == blood_request["state"].lower():
                        location_match = 1
                    
                    compatible_donors.append({
                        "donor": donor_data,
                        "location_match": location_match
                    })
            
            # Sort by location and send alerts
            compatible_donors.sort(key=lambda x: x["location_match"], reverse=True)
            
            alert_data = {
                "type": "emergency_alert",
                "urgency": blood_request["urgency"],
                "blood_request": blood_request,
                "total_compatible_donors": len(compatible_donors),
                "timestamp": datetime.utcnow().isoformat(),
                "alert_id": generate_secure_id()
            }
            
            # Send to all compatible donors if they're connected
            alert_count = 0
            for match in compatible_donors:
                donor_id = match["donor"]["id"]
                if donor_id in self.donor_connections:
                    donor_alert = {
                        **alert_data,
                        "location_priority": match["location_match"],
                        "compatibility": "Direct" if match["donor"]["blood_type"] == blood_request["blood_type_needed"] else "Compatible"
                    }
                    await self.send_to_donor(json.dumps(donor_alert), donor_id)
                    alert_count += 1
            
            # Also broadcast general alert to all connections
            general_alert = {
                "type": "general_alert",
                "message": f"🚨 {blood_request['urgency']} Blood Request: {blood_request['blood_type_needed']} needed at {blood_request['hospital_name']}, {blood_request['city']}",
                "urgency": blood_request["urgency"],
                "compatible_donors_alerted": alert_count,
                "total_compatible_donors": len(compatible_donors),
                "timestamp": datetime.utcnow().isoformat()
            }
            
            await self.broadcast_alert(json.dumps(general_alert))
            
            print(f"Emergency alert sent! {alert_count} connected donors notified out of {len(compatible_donors)} compatible donors")
            
        except Exception as e:
            print(f"Error sending emergency alerts: {e}")

    def calculate_compatibility(self, donor_blood_type: str, requested_blood_type: str) -> bool:
        """Check if donor can donate to the requested blood type"""
        BLOOD_COMPATIBILITY = {
            "O-": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
            "O+": ["O+", "A+", "B+", "AB+"],
            "A-": ["A-", "A+", "AB-", "AB+"],
            "A+": ["A+", "AB+"],
            "B-": ["B-", "B+", "AB-", "AB+"],
            "B+": ["B+", "AB+"],
            "AB-": ["AB-", "AB+"],
            "AB+": ["AB+"]
        }
        compatible_recipients = BLOOD_COMPATIBILITY.get(donor_blood_type, [])
        return requested_blood_type in compatible_recipients

manager = ConnectionManager()

# Blood type compatibility mapping
BLOOD_COMPATIBILITY = {
    "O-": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
    "O+": ["O+", "A+", "B+", "AB+"],
    "A-": ["A-", "A+", "AB-", "AB+"],
    "A+": ["A+", "AB+"],
    "B-": ["B-", "B+", "AB-", "AB+"],
    "B+": ["B+", "AB+"],
    "AB-": ["AB-", "AB+"],
    "AB+": ["AB+"]
}

# Enhanced Models with validation
class Donor(BaseModel):
    id: str = Field(default_factory=generate_secure_id)
    name: str = Field(min_length=2, max_length=100)
    phone: str = Field(min_length=10, max_length=20)
    email: str = Field(min_length=5, max_length=254)
    blood_type: str
    age: int = Field(ge=18, le=65)
    city: str = Field(min_length=2, max_length=100)
    state: str = Field(min_length=2, max_length=100)
    is_available: bool = True
    last_donation: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_online: bool = False

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

class BloodRequest(BaseModel):
    id: str = Field(default_factory=generate_secure_id)
    requester_name: str = Field(min_length=2, max_length=100)
    patient_name: str = Field(min_length=2, max_length=100)
    phone: str = Field(min_length=10, max_length=20)
    email: str = Field(min_length=5, max_length=254)
    blood_type_needed: str
    urgency: str
    units_needed: int = Field(ge=1, le=10)
    hospital_name: str = Field(min_length=2, max_length=200)
    city: str = Field(min_length=2, max_length=100)
    state: str = Field(min_length=2, max_length=100)
    description: Optional[str] = Field(max_length=1000, default=None)
    status: str = "Active"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    alerts_sent: int = 0

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

    @validator('urgency')
    def validate_urgency_level(cls, v):
        valid_urgency = ["Critical", "Urgent", "Normal"]
        if v not in valid_urgency:
            raise ValueError('Invalid urgency level')
        return v

class BloodRequestCreate(BaseModel):
    requester_name: str = Field(min_length=2, max_length=100)
    patient_name: str = Field(min_length=2, max_length=100)
    phone: str = Field(min_length=10, max_length=20)
    email: str = Field(min_length=5, max_length=254)
    blood_type_needed: str
    urgency: str
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

    @validator('urgency')
    def validate_urgency_level(cls, v):
        valid_urgency = ["Critical", "Urgent", "Normal"]
        if v not in valid_urgency:
            raise ValueError('Invalid urgency level')
        return v

class EmergencyAlert(BaseModel):
    id: str = Field(default_factory=generate_secure_id)
    blood_request_id: str
    alert_type: str
    donors_notified: int
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Helper functions
def calculate_compatibility(donor_blood_type: str, requested_blood_type: str) -> bool:
    """Check if donor can donate to the requested blood type"""
    compatible_recipients = BLOOD_COMPATIBILITY.get(donor_blood_type, [])
    return requested_blood_type in compatible_recipients

# WebSocket endpoint with basic security
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Send welcome message with disclaimer
        welcome_msg = {
            "type": "welcome",
            "message": "Connected to BloodConnect Emergency Alerts - FOR DEMONSTRATION PURPOSES ONLY",
            "disclaimer": "This system is for demonstration only. Not for actual medical emergencies.",
            "timestamp": datetime.utcnow().isoformat()
        }
        await manager.send_personal_message(json.dumps(welcome_msg), websocket)
        
        while True:
            # Keep connection alive and handle incoming messages
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=1.0)
                message = json.loads(data)
                
                # Handle donor registration for targeted alerts
                if message.get("type") == "register_donor":
                    donor_id = sanitize_input(message.get("donor_id", ""))
                    if donor_id and len(donor_id) > 0:
                        manager.donor_connections[donor_id] = websocket
                        # Update donor online status
                        await db.donors.update_one(
                            {"id": donor_id},
                            {"$set": {"is_online": True}}
                        )
                        response = {
                            "type": "registration_success",
                            "message": f"Registered for emergency alerts - DEMO MODE",
                            "donor_id": donor_id
                        }
                        await manager.send_personal_message(json.dumps(response), websocket)
                        
            except asyncio.TimeoutError:
                # Keep connection alive
                continue
            except json.JSONDecodeError:
                # Handle non-JSON messages
                await manager.send_personal_message(
                    json.dumps({"type": "error", "message": "Invalid message format"}), 
                    websocket
                )
            except Exception as e:
                print(f"WebSocket error: {e}")
                break
                
    except WebSocketDisconnect:
        # Find and remove donor from online status
        disconnected_donor = None
        for donor_id, conn in manager.donor_connections.items():
            if conn == websocket:
                disconnected_donor = donor_id
                break
                
        if disconnected_donor:
            await db.donors.update_one(
                {"id": disconnected_donor},
                {"$set": {"is_online": False}}
            )
            
        manager.disconnect(websocket, disconnected_donor)

# Routes with rate limiting
@api_router.get("/")
@limiter.limit("10/minute")
async def root(request):
    return {
        "message": "BloodConnect Emergency Response System API",
        "disclaimer": "FOR DEMONSTRATION PURPOSES ONLY - Not for actual medical emergencies",
        "version": "1.0.0"
    }

# Donor routes
@api_router.post("/donors", response_model=Donor)
@limiter.limit("5/minute")
async def register_donor(request, donor_data: DonorCreate):
    try:
        # Check if donor already exists
        existing_donor = await db.donors.find_one({"email": donor_data.email})
        if existing_donor:
            raise HTTPException(status_code=400, detail="Donor with this email already exists")
        
        donor = Donor(**donor_data.dict())
        await db.donors.insert_one(donor.dict())
        
        # Broadcast new donor registration
        alert = {
            "type": "new_donor",
            "message": f"🩸 New {donor.blood_type} donor registered in {donor.city}, {donor.state}",
            "donor_blood_type": donor.blood_type,
            "location": f"{donor.city}, {donor.state}",
            "timestamp": datetime.utcnow().isoformat()
        }
        await manager.broadcast_alert(json.dumps(alert))
        
        return donor
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.get("/donors", response_model=List[Donor])
@limiter.limit("20/minute")
async def get_donors(request):
    try:
        donors = await db.donors.find({"is_available": True}).to_list(1000)
        return [Donor(**donor) for donor in donors]
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.get("/donors/{donor_id}", response_model=Donor)
@limiter.limit("30/minute")
async def get_donor(request, donor_id: str):
    try:
        donor_id = sanitize_input(donor_id)
        donor = await db.donors.find_one({"id": donor_id})
        if not donor:
            raise HTTPException(status_code=404, detail="Donor not found")
        return Donor(**donor)
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail="Internal server error")

# Blood Request routes
@api_router.post("/blood-requests", response_model=BloodRequest)
@limiter.limit("10/minute")
async def create_blood_request(request, request_data: BloodRequestCreate):
    try:
        blood_request = BloodRequest(**request_data.dict())
        await db.blood_requests.insert_one(blood_request.dict())
        
        # Send emergency alerts for Critical and Urgent requests
        if blood_request.urgency in ["Critical", "Urgent"]:
            asyncio.create_task(manager.notify_compatible_donors(blood_request.dict()))
            
            # Save alert record
            alert = EmergencyAlert(
                blood_request_id=blood_request.id,
                alert_type=blood_request.urgency.lower(),
                donors_notified=len(manager.active_connections)
            )
            await db.emergency_alerts.insert_one(alert.dict())
        
        return blood_request
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.get("/blood-requests", response_model=List[BloodRequest])
@limiter.limit("20/minute")
async def get_blood_requests(request):
    try:
        requests = await db.blood_requests.find({"status": "Active"}).sort("created_at", -1).to_list(1000)
        return [BloodRequest(**req) for req in requests]
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.get("/blood-requests/{request_id}", response_model=BloodRequest)
@limiter.limit("30/minute")
async def get_blood_request(request, request_id: str):
    try:
        request_id = sanitize_input(request_id)
        blood_req = await db.blood_requests.find_one({"id": request_id})
        if not blood_req:
            raise HTTPException(status_code=404, detail="Blood request not found")
        return BloodRequest(**blood_req)
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail="Internal server error")

# Matching route
@api_router.get("/match-donors/{request_id}")
@limiter.limit("15/minute")
async def match_donors(request, request_id: str):
    try:
        request_id = sanitize_input(request_id)
        # Get the blood request
        blood_req = await db.blood_requests.find_one({"id": request_id})
        if not blood_req:
            raise HTTPException(status_code=404, detail="Blood request not found")
        
        blood_request = BloodRequest(**blood_req)
        
        # Find compatible donors
        all_donors = await db.donors.find({"is_available": True}).to_list(1000)
        compatible_donors = []
        
        for donor_data in all_donors:
            donor = Donor(**donor_data)
            if calculate_compatibility(donor.blood_type, blood_request.blood_type_needed):
                # Prioritize donors in same city/state
                location_match = 0
                if donor.city.lower() == blood_request.city.lower():
                    location_match = 2
                elif donor.state.lower() == blood_request.state.lower():
                    location_match = 1
                
                compatible_donors.append({
                    "donor": donor.dict(),
                    "location_match": location_match,
                    "compatibility": "Direct" if donor.blood_type == blood_request.blood_type_needed else "Compatible",
                    "is_online": donor.is_online
                })
        
        # Sort by online status, then location match and blood type compatibility
        compatible_donors.sort(key=lambda x: (x["is_online"], x["location_match"], x["compatibility"] == "Direct"), reverse=True)
        
        return {
            "request": blood_request.dict(),
            "compatible_donors": compatible_donors,
            "total_matches": len(compatible_donors),
            "online_donors": len([d for d in compatible_donors if d["is_online"]])
        }
        
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail="Internal server error")

# Alert management routes
@api_router.get("/alerts/recent")
@limiter.limit("10/minute")
async def get_recent_alerts(request):
    try:
        alerts = await db.emergency_alerts.find().sort("created_at", -1).limit(50).to_list(50)
        return [EmergencyAlert(**alert) for alert in alerts]
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.post("/alerts/send-reminder/{request_id}")
@limiter.limit("3/minute")
async def send_reminder_alert(request, request_id: str):
    try:
        request_id = sanitize_input(request_id)
        blood_req = await db.blood_requests.find_one({"id": request_id})
        if not blood_req:
            raise HTTPException(status_code=404, detail="Blood request not found")
        
        blood_request = BloodRequest(**blood_req)
        
        # Send reminder alert
        await manager.notify_compatible_donors(blood_request.dict())
        
        # Update alerts sent count
        await db.blood_requests.update_one(
            {"id": request_id},
            {"$inc": {"alerts_sent": 1}}
        )
        
        return {"message": "Reminder alert sent successfully - DEMO MODE"}
        
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail="Internal server error")

# Statistics with real-time data
@api_router.get("/stats")
@limiter.limit("30/minute")
async def get_stats(request):
    try:
        total_donors = await db.donors.count_documents({"is_available": True})
        online_donors = await db.donors.count_documents({"is_available": True, "is_online": True})
        total_requests = await db.blood_requests.count_documents({"status": "Active"})
        total_alerts_sent = len(manager.active_connections)
        
        # Count by blood type
        blood_type_stats = {}
        for blood_type in ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]:
            donor_count = await db.donors.count_documents({"blood_type": blood_type, "is_available": True})
            online_count = await db.donors.count_documents({"blood_type": blood_type, "is_available": True, "is_online": True})
            request_count = await db.blood_requests.count_documents({"blood_type_needed": blood_type, "status": "Active"})
            blood_type_stats[blood_type] = {
                "donors": donor_count,
                "online_donors": online_count,
                "requests": request_count
            }
        
        return {
            "total_donors": total_donors,
            "online_donors": online_donors,
            "total_active_requests": total_requests,
            "active_alert_connections": total_alerts_sent,
            "blood_type_breakdown": blood_type_stats,
            "system_status": "demo_mode",
            "disclaimer": "Demo system - not for actual medical use"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()