from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
import math


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

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

# Models
class Donor(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: str
    email: str
    blood_type: str
    age: int
    city: str
    state: str
    is_available: bool = True
    last_donation: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class DonorCreate(BaseModel):
    name: str
    phone: str
    email: str
    blood_type: str
    age: int
    city: str
    state: str

class BloodRequest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    requester_name: str
    patient_name: str
    phone: str
    email: str
    blood_type_needed: str
    urgency: str  # "Critical", "Urgent", "Normal"
    units_needed: int
    hospital_name: str
    city: str
    state: str
    description: Optional[str] = None
    status: str = "Active"  # "Active", "Fulfilled", "Cancelled"
    created_at: datetime = Field(default_factory=datetime.utcnow)

class BloodRequestCreate(BaseModel):
    requester_name: str
    patient_name: str
    phone: str
    email: str
    blood_type_needed: str
    urgency: str
    units_needed: int
    hospital_name: str
    city: str
    state: str
    description: Optional[str] = None

# Helper functions
def calculate_compatibility(donor_blood_type: str, requested_blood_type: str) -> bool:
    """Check if donor can donate to the requested blood type"""
    compatible_recipients = BLOOD_COMPATIBILITY.get(donor_blood_type, [])
    return requested_blood_type in compatible_recipients

# Routes
@api_router.get("/")
async def root():
    return {"message": "Blood Donation App API"}

# Donor routes
@api_router.post("/donors", response_model=Donor)
async def register_donor(donor_data: DonorCreate):
    # Validate blood type
    valid_blood_types = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
    if donor_data.blood_type not in valid_blood_types:
        raise HTTPException(status_code=400, detail="Invalid blood type")
    
    # Check if donor already exists
    existing_donor = await db.donors.find_one({"email": donor_data.email})
    if existing_donor:
        raise HTTPException(status_code=400, detail="Donor with this email already exists")
    
    donor = Donor(**donor_data.dict())
    await db.donors.insert_one(donor.dict())
    return donor

@api_router.get("/donors", response_model=List[Donor])
async def get_donors():
    donors = await db.donors.find({"is_available": True}).to_list(1000)
    return [Donor(**donor) for donor in donors]

@api_router.get("/donors/{donor_id}", response_model=Donor)
async def get_donor(donor_id: str):
    donor = await db.donors.find_one({"id": donor_id})
    if not donor:
        raise HTTPException(status_code=404, detail="Donor not found")
    return Donor(**donor)

# Blood Request routes
@api_router.post("/blood-requests", response_model=BloodRequest)
async def create_blood_request(request_data: BloodRequestCreate):
    # Validate blood type
    valid_blood_types = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
    if request_data.blood_type_needed not in valid_blood_types:
        raise HTTPException(status_code=400, detail="Invalid blood type")
    
    # Validate urgency
    valid_urgency = ["Critical", "Urgent", "Normal"]
    if request_data.urgency not in valid_urgency:
        raise HTTPException(status_code=400, detail="Invalid urgency level")
    
    blood_request = BloodRequest(**request_data.dict())
    await db.blood_requests.insert_one(blood_request.dict())
    return blood_request

@api_router.get("/blood-requests", response_model=List[BloodRequest])
async def get_blood_requests():
    requests = await db.blood_requests.find({"status": "Active"}).sort("created_at", -1).to_list(1000)
    return [BloodRequest(**request) for request in requests]

@api_router.get("/blood-requests/{request_id}", response_model=BloodRequest)
async def get_blood_request(request_id: str):
    request = await db.blood_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Blood request not found")
    return BloodRequest(**request)

# Matching route
@api_router.get("/match-donors/{request_id}")
async def match_donors(request_id: str):
    # Get the blood request
    request = await db.blood_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Blood request not found")
    
    blood_request = BloodRequest(**request)
    
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
                "compatibility": "Direct" if donor.blood_type == blood_request.blood_type_needed else "Compatible"
            })
    
    # Sort by location match and blood type compatibility
    compatible_donors.sort(key=lambda x: (x["location_match"], x["compatibility"] == "Direct"), reverse=True)
    
    return {
        "request": blood_request.dict(),
        "compatible_donors": compatible_donors,
        "total_matches": len(compatible_donors)
    }

# Statistics
@api_router.get("/stats")
async def get_stats():
    total_donors = await db.donors.count_documents({"is_available": True})
    total_requests = await db.blood_requests.count_documents({"status": "Active"})
    
    # Count by blood type
    blood_type_stats = {}
    for blood_type in ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]:
        donor_count = await db.donors.count_documents({"blood_type": blood_type, "is_available": True})
        request_count = await db.blood_requests.count_documents({"blood_type_needed": blood_type, "status": "Active"})
        blood_type_stats[blood_type] = {
            "donors": donor_count,
            "requests": request_count
        }
    
    return {
        "total_donors": total_donors,
        "total_active_requests": total_requests,
        "blood_type_breakdown": blood_type_stats
    }

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