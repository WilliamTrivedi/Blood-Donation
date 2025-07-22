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
from datetime import datetime, timedelta
import json
import asyncio
import re
import bleach
import hashlib
import secrets

# Import our custom modules
from auth import (
    UserRole, get_current_user, get_current_user_optional, require_role, require_roles,
    create_access_token, create_refresh_token, verify_password, get_password_hash,
    validate_password, Token, UserLogin, create_demo_token, User
)
from models import (
    Donor, DonorCreate, BloodRequest, BloodRequestCreate, Hospital, HospitalCreate,
    EmergencyAlert, UserDB as User, UserCreate, HospitalStatus, BloodRequestStatus, BloodRequestUrgency
)


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

# Input validation and sanitization functions
def validate_phone(phone: str) -> bool:
    """Validate phone number format - allow common phone formats"""
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
            "message": "Connected to BloodConnect Emergency Alerts v2.0 - FOR DEMONSTRATION PURPOSES ONLY",
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
                    from models import sanitize_input
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
                            "message": f"Registered for emergency alerts - DEMO MODE v2.0",
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

# Routes with rate limiting and authentication

# Authentication routes
@api_router.post("/auth/register", response_model=Token)
@limiter.limit("3/minute")
async def register_user(request: Request, user_data: UserCreate):
    """Register a new user account"""
    try:
        # Validate password strength
        if not validate_password(user_data.password):
            raise HTTPException(
                status_code=400, 
                detail="Password must be at least 8 characters with uppercase, lowercase, and number"
            )
        
        # Check if user already exists
        existing_user = await db.users.find_one({"email": user_data.email})
        if existing_user:
            raise HTTPException(status_code=400, detail="User with this email already exists")
        
        # Create user account
        hashed_password = get_password_hash(user_data.password)
        user = User(
            email=user_data.email,
            password_hash=hashed_password,
            role=user_data.role,
            donor_id=user_data.donor_id,
            hospital_id=user_data.hospital_id
        )
        
        await db.users.insert_one(user.dict())
        
        # Create tokens
        token_data = {"sub": user.email, "role": user.role.value, "user_id": user.id}
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)
        
        return Token(
            access_token=access_token,
            refresh_token=refresh_token,
            user=user
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.post("/auth/login", response_model=Token)
@limiter.limit("5/minute")
async def login_user(request: Request, login_data: UserLogin):
    """Login user and return authentication tokens"""
    try:
        # Find user by email
        user_data = await db.users.find_one({"email": login_data.email})
        if not user_data or not verify_password(login_data.password, user_data["password_hash"]):
            raise HTTPException(
                status_code=401,
                detail="Incorrect email or password"
            )
        
        user = User(**user_data)
        if not user.is_active:
            raise HTTPException(status_code=401, detail="Account is deactivated")
        
        # Update last login
        await db.users.update_one(
            {"id": user.id},
            {"$set": {"last_login": datetime.utcnow()}}
        )
        
        # Create tokens
        token_data = {"sub": user.email, "role": user.role.value, "user_id": user.id}
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)
        
        return Token(
            access_token=access_token,
            refresh_token=refresh_token,
            user=user
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.get("/auth/demo-token")
@limiter.limit("10/minute")
async def get_demo_token(request: Request, role: UserRole = UserRole.DONOR):
    """Get a demo token for testing purposes"""
    demo_token = create_demo_token(role)
    return {"access_token": demo_token, "token_type": "bearer", "demo": True}

@api_router.get("/auth/me")
@limiter.limit("30/minute")
async def get_current_user_info(request: Request, current_user: User = Depends(get_current_user)):
    """Get current user information"""
    return current_user

# Hospital Management Routes
@api_router.post("/hospitals", response_model=Hospital)
@limiter.limit("3/minute")
async def register_hospital(request: Request, hospital_data: HospitalCreate, current_user: User = Depends(require_roles([UserRole.HOSPITAL, UserRole.ADMIN]))):
    """Register a new hospital"""
    try:
        # Check if hospital already exists
        existing_hospital = await db.hospitals.find_one({
            "$or": [
                {"email": hospital_data.email},
                {"license_number": hospital_data.license_number}
            ]
        })
        if existing_hospital:
            raise HTTPException(status_code=400, detail="Hospital with this email or license number already exists")
        
        hospital = Hospital(**hospital_data.dict())
        await db.hospitals.insert_one(hospital.dict())
        
        # Link to user account if hospital role
        if current_user.role == UserRole.HOSPITAL:
            await db.users.update_one(
                {"id": current_user.id},
                {"$set": {"hospital_id": hospital.id}}
            )
        
        return hospital
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.get("/hospitals", response_model=List[Hospital])
@limiter.limit("20/minute")
async def get_hospitals(request: Request, status: Optional[HospitalStatus] = None, current_user: User = Depends(get_current_user_optional)):
    """Get list of hospitals"""
    try:
        query = {}
        if status:
            query["status"] = status.value
        else:
            # Non-admin users can only see verified hospitals
            if not current_user or current_user.role != UserRole.ADMIN:
                query["status"] = HospitalStatus.VERIFIED.value
        
        hospitals = await db.hospitals.find(query).to_list(1000)
        return [Hospital(**hospital) for hospital in hospitals]
        
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.put("/hospitals/{hospital_id}/verify")
@limiter.limit("10/minute")
async def verify_hospital(request: Request, hospital_id: str, status: HospitalStatus, current_user: User = Depends(require_role(UserRole.ADMIN))):
    """Verify or reject a hospital (Admin only)"""
    try:
        result = await db.hospitals.update_one(
            {"id": hospital_id},
            {"$set": {
                "status": status.value,
                "verified_at": datetime.utcnow() if status == HospitalStatus.VERIFIED else None,
                "verified_by": current_user.id,
                "updated_at": datetime.utcnow()
            }}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Hospital not found")
        
        return {"message": f"Hospital status updated to {status.value}"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.get("/")
@limiter.limit("10/minute")
async def root(request: Request):
    return {
        "message": "BloodConnect Emergency Response System API with Authentication",
        "disclaimer": "FOR DEMONSTRATION PURPOSES ONLY - Not for actual medical emergencies",
        "version": "2.0.0",
        "features": ["Real-time alerts", "User authentication", "Hospital verification", "Role-based access"]
    }

# Donor routes (enhanced with optional authentication)
@api_router.post("/donors", response_model=Donor)
@limiter.limit("5/minute")
async def register_donor(request: Request, donor_data: DonorCreate, current_user: User = Depends(get_current_user_optional)):
    try:
        # Check if donor already exists
        existing_donor = await db.donors.find_one({"email": donor_data.email})
        if existing_donor:
            raise HTTPException(status_code=400, detail="Donor with this email already exists")
        
        donor = Donor(**donor_data.dict())
        
        # Link to user account if authenticated
        if current_user and current_user.role in [UserRole.DONOR, UserRole.ADMIN]:
            donor.user_id = current_user.id
            # Update user account to link to donor
            await db.users.update_one(
                {"id": current_user.id},
                {"$set": {"donor_id": donor.id}}
            )
        
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
async def get_donors(request: Request, current_user: User = Depends(get_current_user_optional)):
    try:
        donors = await db.donors.find({"is_available": True}).to_list(1000)
        return [Donor(**donor) for donor in donors]
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.get("/donors/{donor_id}", response_model=Donor)
@limiter.limit("30/minute")
async def get_donor(request: Request, donor_id: str, current_user: User = Depends(get_current_user_optional)):
    try:
        from models import sanitize_input
        donor_id = sanitize_input(donor_id)
        donor = await db.donors.find_one({"id": donor_id})
        if not donor:
            raise HTTPException(status_code=404, detail="Donor not found")
        return Donor(**donor)
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.put("/donors/{donor_id}")
@limiter.limit("10/minute")
async def update_donor(request: Request, donor_id: str, donor_data: DonorCreate, current_user: User = Depends(require_roles([UserRole.DONOR, UserRole.ADMIN]))):
    """Update donor information (donor or admin only)"""
    try:
        from models import sanitize_input
        donor_id = sanitize_input(donor_id)
        
        # Check if user owns this donor record or is admin
        if current_user.role == UserRole.DONOR and current_user.donor_id != donor_id:
            raise HTTPException(status_code=403, detail="Access denied. You can only update your own donor profile.")
        
        updated_data = donor_data.dict()
        updated_data["updated_at"] = datetime.utcnow()
        
        result = await db.donors.update_one(
            {"id": donor_id},
            {"$set": updated_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Donor not found")
        
        return {"message": "Donor information updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

# Blood Request routes (enhanced with hospital integration)
@api_router.post("/blood-requests", response_model=BloodRequest)
@limiter.limit("10/minute")
async def create_blood_request(request: Request, request_data: BloodRequestCreate, current_user: User = Depends(get_current_user_optional)):
    try:
        blood_request = BloodRequest(**request_data.dict())
        
        # Enhanced processing for hospital users
        if current_user:
            blood_request.user_id = current_user.id
            
            # If user is hospital, verify and link to hospital
            if current_user.role == UserRole.HOSPITAL and current_user.hospital_id:
                hospital = await db.hospitals.find_one({"id": current_user.hospital_id})
                if hospital and hospital.get("status") == HospitalStatus.VERIFIED.value:
                    blood_request.hospital_id = current_user.hospital_id
                    blood_request.hospital_name = hospital.get("name", blood_request.hospital_name)
                    # Increase priority for verified hospitals
                    blood_request.priority_score += 2.0
        
        # Set expiration based on urgency
        if blood_request.urgency == BloodRequestUrgency.CRITICAL:
            blood_request.expires_at = datetime.utcnow() + timedelta(hours=6)
            blood_request.priority_score += 5.0
        elif blood_request.urgency == BloodRequestUrgency.URGENT:
            blood_request.expires_at = datetime.utcnow() + timedelta(hours=24)
            blood_request.priority_score += 2.0
        else:
            blood_request.expires_at = datetime.utcnow() + timedelta(days=7)
        
        await db.blood_requests.insert_one(blood_request.dict())
        
        # Send emergency alerts for Critical and Urgent requests
        if blood_request.urgency in [BloodRequestUrgency.CRITICAL, BloodRequestUrgency.URGENT]:
            asyncio.create_task(manager.notify_compatible_donors(blood_request.dict()))
            
            # Save alert record
            alert = EmergencyAlert(
                blood_request_id=blood_request.id,
                alert_type=blood_request.urgency.value.lower(),
                donors_notified=len(manager.active_connections),
                hospitals_notified=1 if current_user and current_user.role == UserRole.HOSPITAL else 0
            )
            await db.emergency_alerts.insert_one(alert.dict())
        
        return blood_request
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.get("/blood-requests", response_model=List[BloodRequest])
@limiter.limit("20/minute")
async def get_blood_requests(request: Request, status: Optional[BloodRequestStatus] = None, urgency: Optional[BloodRequestUrgency] = None, current_user: User = Depends(get_current_user_optional)):
    try:
        query = {}
        
        # Filter by status if provided
        if status:
            query["status"] = status.value
        else:
            query["status"] = BloodRequestStatus.ACTIVE.value
        
        # Filter by urgency if provided
        if urgency:
            query["urgency"] = urgency.value
        
        # Hospital users can see their own requests plus all active ones
        if current_user and current_user.role == UserRole.HOSPITAL:
            query = {
                "$or": [
                    query,
                    {"user_id": current_user.id}
                ]
            }
        
        requests = await db.blood_requests.find(query).sort("priority_score", -1).sort("created_at", -1).to_list(1000)
        return [BloodRequest(**req) for req in requests]
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.get("/blood-requests/{request_id}", response_model=BloodRequest)
@limiter.limit("30/minute")
async def get_blood_request(request: Request, request_id: str, current_user: User = Depends(get_current_user_optional)):
    try:
        from models import sanitize_input
        request_id = sanitize_input(request_id)
        blood_req = await db.blood_requests.find_one({"id": request_id})
        if not blood_req:
            raise HTTPException(status_code=404, detail="Blood request not found")
        
        # Increment views count
        await db.blood_requests.update_one(
            {"id": request_id},
            {"$inc": {"views_count": 1}}
        )
        
        return BloodRequest(**blood_req)
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.put("/blood-requests/{request_id}/status")
@limiter.limit("10/minute")
async def update_request_status(request: Request, request_id: str, status: BloodRequestStatus, current_user: User = Depends(require_roles([UserRole.HOSPITAL, UserRole.ADMIN]))):
    """Update blood request status (hospital or admin only)"""
    try:
        from models import sanitize_input
        request_id = sanitize_input(request_id)
        
        # Check if user owns this request (for hospitals) or is admin
        if current_user.role == UserRole.HOSPITAL:
            blood_req = await db.blood_requests.find_one({"id": request_id})
            if not blood_req or blood_req.get("user_id") != current_user.id:
                raise HTTPException(status_code=403, detail="Access denied. You can only update your own requests.")
        
        result = await db.blood_requests.update_one(
            {"id": request_id},
            {"$set": {
                "status": status.value,
                "updated_at": datetime.utcnow()
            }}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Blood request not found")
        
        return {"message": f"Request status updated to {status.value}"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

# Matching route
@api_router.get("/match-donors/{request_id}")
@limiter.limit("15/minute")
async def match_donors(request: Request, request_id: str):
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
async def get_recent_alerts(request: Request):
    try:
        alerts = await db.emergency_alerts.find().sort("created_at", -1).limit(50).to_list(50)
        return [EmergencyAlert(**alert) for alert in alerts]
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.post("/alerts/send-reminder/{request_id}")
@limiter.limit("3/minute")
async def send_reminder_alert(request: Request, request_id: str):
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
async def get_stats(request: Request):
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