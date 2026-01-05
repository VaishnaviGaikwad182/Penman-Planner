from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import numpy as np
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


# Define Models
class WeatherInput(BaseModel):
    temperature: float  # °C
    humidity: float  # %
    wind_speed: float  # m/s
    solar_radiation: float  # MJ/m²/day
    location: Optional[str] = "Unknown Location"

class EvaporationResult(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    evaporation_rate: float  # mm/day
    weather_input: WeatherInput
    penman_components: dict
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StoragePlanningResult(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    reservoir_capacity_needed: float  # m³
    seasonal_analysis: dict
    irrigation_recommendations: List[dict]
    water_balance: dict
    evaporation_data: EvaporationResult
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str


def calculate_penman_evaporation(temperature, humidity, wind_speed, solar_radiation):
    """
    Calculate evaporation rate using original Penman equation
    E = (Δ/(Δ+γ)) * Rn + (γ/(Δ+γ)) * f(u) * (es - ea)
    """
    
    # Constants
    psychrometric_constant = 0.665  # kPa/°C
    
    # Calculate saturation vapor pressure (es) in kPa using Tetens equation
    es = 0.6108 * math.exp((17.27 * temperature) / (temperature + 237.3))
    
    # Calculate actual vapor pressure (ea) in kPa
    ea = es * (humidity / 100.0)
    
    # Calculate slope of saturation vapor pressure curve (Δ) in kPa/°C
    delta = (4098 * es) / ((temperature + 237.3) ** 2)
    
    # Net radiation (Rn) - using solar radiation as approximation
    # Converting MJ/m²/day to mm/day equivalent (assuming latent heat of 2.45 MJ/kg)
    rn = solar_radiation / 2.45
    
    # Wind function f(u) - simplified version
    # f(u) = 2.6 * (1 + 0.54 * u) where u is wind speed in m/s
    wind_function = 2.6 * (1 + 0.54 * wind_speed)
    
    # Calculate Penman evaporation
    radiation_component = (delta / (delta + psychrometric_constant)) * rn
    aerodynamic_component = (psychrometric_constant / (delta + psychrometric_constant)) * wind_function * (es - ea)
    
    evaporation = radiation_component + aerodynamic_component
    
    # Return components for analysis
    components = {
        "radiation_component": round(radiation_component, 3),
        "aerodynamic_component": round(aerodynamic_component, 3),
        "saturation_vapor_pressure": round(es, 3),
        "actual_vapor_pressure": round(ea, 3),
        "vapor_pressure_deficit": round(es - ea, 3),
        "slope_vapor_pressure": round(delta, 3),
        "wind_function": round(wind_function, 3),
        "net_radiation_equivalent": round(rn, 3)
    }
    
    return max(0, evaporation), components


def calculate_storage_planning(evaporation_result, reservoir_surface_area=1000):
    """
    Calculate storage planning based on evaporation rate
    """
    evap_rate = evaporation_result.evaporation_rate
    
    # Daily evaporation loss in m³
    daily_loss = (evap_rate / 1000) * reservoir_surface_area  # Convert mm to m
    
    # Seasonal analysis (assuming 4 seasons)
    seasonal_factors = {
        "spring": 0.8,
        "summer": 1.3,
        "autumn": 0.7,
        "winter": 0.4
    }
    
    seasonal_analysis = {}
    for season, factor in seasonal_factors.items():
        seasonal_loss = daily_loss * factor * 90  # 90 days per season
        seasonal_analysis[season] = {
            "daily_evaporation_loss": round(daily_loss * factor, 2),
            "seasonal_total_loss": round(seasonal_loss, 2),
            "percentage_factor": factor
        }
    
    # Annual total evaporation loss
    annual_loss = sum([season_data["seasonal_total_loss"] for season_data in seasonal_analysis.values()])
    
    # Recommended reservoir capacity (considering 20% buffer and evaporation losses)
    recommended_capacity = annual_loss * 1.5  # 50% buffer for safety
    
    # Water balance analysis
    water_balance = {
        "annual_evaporation_loss": round(annual_loss, 2),
        "recommended_buffer": round(annual_loss * 0.5, 2),
        "total_recommended_capacity": round(recommended_capacity, 2),
        "surface_area_assumed": reservoir_surface_area
    }
    
    # Irrigation recommendations
    irrigation_recommendations = [
        {
            "period": "Summer (Mar-Jun)",
            "irrigation_frequency": "Every 3-4 days",
            "water_requirement": "High",
            "evaporation_consideration": "High evaporation losses — increase irrigation by 30%"
        },
        {
            "period": "Rainy (Jul-Oct)",
            "irrigation_frequency": "Every 10-15 days",
            "water_requirement": "Low",
            "evaporation_consideration": "Rainfall compensates — minimal irrigation required"
        },
        {
            "period": "Winter (Nov-Feb)",
            "irrigation_frequency": "Every 7-10 days",
            "water_requirement": "Medium",
            "evaporation_consideration": "Low evaporation — moderate irrigation needed"
        }
    ]
    
    return {
        "reservoir_capacity_needed": round(recommended_capacity, 2),
        "seasonal_analysis": seasonal_analysis,
        "irrigation_recommendations": irrigation_recommendations,
        "water_balance": water_balance
    }


# Add routes to the router
@api_router.get("/")
async def root():
    return {"message": "Penman Evaporation Calculator API"}

@api_router.post("/calculate-evaporation", response_model=EvaporationResult)
async def calculate_evaporation(weather_input: WeatherInput):
    """Calculate evaporation rate using Penman equation"""
    evaporation_rate, components = calculate_penman_evaporation(
        weather_input.temperature,
        weather_input.humidity,
        weather_input.wind_speed,
        weather_input.solar_radiation
    )
    
    result = EvaporationResult(
        evaporation_rate=round(evaporation_rate, 3),
        weather_input=weather_input,
        penman_components=components
    )
    
    # Store in database
    result_dict = result.dict()
    result_dict['timestamp'] = result_dict['timestamp'].isoformat()
    await db.evaporation_results.insert_one(result_dict)
    
    return result

@api_router.post("/calculate-storage-planning", response_model=StoragePlanningResult)
async def calculate_storage_planning_endpoint(weather_input: WeatherInput, surface_area: Optional[float] = 1000):
    """Calculate comprehensive storage planning based on evaporation data"""
    
    # First calculate evaporation
    evaporation_rate, components = calculate_penman_evaporation(
        weather_input.temperature,
        weather_input.humidity,
        weather_input.wind_speed,
        weather_input.solar_radiation
    )
    
    evaporation_result = EvaporationResult(
        evaporation_rate=round(evaporation_rate, 3),
        weather_input=weather_input,
        penman_components=components
    )
    
    # Calculate storage planning
    planning_data = calculate_storage_planning(evaporation_result, surface_area)
    
    storage_result = StoragePlanningResult(
        reservoir_capacity_needed=planning_data["reservoir_capacity_needed"],
        seasonal_analysis=planning_data["seasonal_analysis"],
        irrigation_recommendations=planning_data["irrigation_recommendations"],
        water_balance=planning_data["water_balance"],
        evaporation_data=evaporation_result
    )
    
    # Store in database
    result_dict = storage_result.dict()
    result_dict['timestamp'] = result_dict['timestamp'].isoformat()
    result_dict['evaporation_data']['timestamp'] = result_dict['evaporation_data']['timestamp'].isoformat()
    await db.storage_planning_results.insert_one(result_dict)
    
    return storage_result

@api_router.get("/evaporation-history", response_model=List[EvaporationResult])
async def get_evaporation_history():
    """Get historical evaporation calculations"""
    results = await db.evaporation_results.find().sort("timestamp", -1).limit(50).to_list(50)
    
    # Parse timestamps back to datetime objects
    for result in results:
        if isinstance(result.get('timestamp'), str):
            result['timestamp'] = datetime.fromisoformat(result['timestamp'])
    
    return [EvaporationResult(**result) for result in results]

@api_router.get("/storage-planning-history", response_model=List[StoragePlanningResult])
async def get_storage_planning_history():
    """Get historical storage planning calculations"""
    results = await db.storage_planning_results.find().sort("timestamp", -1).limit(50).to_list(50)
    
    # Parse timestamps back to datetime objects
    for result in results:
        if isinstance(result.get('timestamp'), str):
            result['timestamp'] = datetime.fromisoformat(result['timestamp'])
        if isinstance(result.get('evaporation_data', {}).get('timestamp'), str):
            result['evaporation_data']['timestamp'] = datetime.fromisoformat(result['evaporation_data']['timestamp'])
    
    return [StoragePlanningResult(**result) for result in results]

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    status_obj_dict = status_obj.dict()
    status_obj_dict['timestamp'] = status_obj_dict['timestamp'].isoformat()
    await db.status_checks.insert_one(status_obj_dict)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    
    # Parse timestamps back to datetime objects
    for check in status_checks:
        if isinstance(check.get('timestamp'), str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return [StatusCheck(**status_check) for status_check in status_checks]


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
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