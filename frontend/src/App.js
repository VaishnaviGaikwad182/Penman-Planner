import React, { useState, useEffect } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import axios from "axios";
import { Card, CardHeader, CardTitle, CardContent } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Badge } from "./components/ui/badge";
import { Separator } from "./components/ui/separator";
import { Alert, AlertDescription } from "./components/ui/alert";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { DropletIcon, CloudIcon, Wind, Sun, Calculator, TrendingUp, Waves, BarChart3, Info, AlertCircle } from "lucide-react";

const BACKEND_URL = "http://localhost:8000";
const API = `${BACKEND_URL}/api`;

// Color palette for charts
const COLORS = ['#0891b2', '#0d9488', '#059669', '#16a34a', '#65a30d', '#ca8a04', '#ea580c', '#dc2626'];

const Dashboard = () => {
  const [weatherData, setWeatherData] = useState({
    temperature: '',
    humidity: '',
    wind_speed: '',
    solar_radiation: '',
    location: ''
  });
  
  const [surfaceArea, setSurfaceArea] = useState('1000');
  const [evaporationResult, setEvaporationResult] = useState(null);
  const [storagePlanningResult, setStoragePlanningResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await axios.get(`${API}/evaporation-history`);
      setHistory(response.data.slice(0, 10));
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setWeatherData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateInputs = () => {
    const { temperature, humidity, wind_speed, solar_radiation } = weatherData;
    
    if (!temperature || !humidity || !wind_speed || !solar_radiation) {
      setError('Please fill in all required fields');
      return false;
    }
    
    const temp = parseFloat(temperature);
    const hum = parseFloat(humidity);
    const wind = parseFloat(wind_speed);
    const solar = parseFloat(solar_radiation);
    
    if (temp < -50 || temp > 60) {
      setError('Temperature must be between -50°C and 60°C');
      return false;
    }
    
    if (hum < 0 || hum > 100) {
      setError('Humidity must be between 0% and 100%');
      return false;
    }
    
    if (wind < 0 || wind > 50) {
      setError('Wind speed must be between 0 and 50 m/s');
      return false;
    }
    
    if (solar < 0 || solar > 40) {
      setError('Solar radiation must be between 0 and 40 MJ/m²/day');
      return false;
    }
    
    return true;
  };

  const calculateEvaporation = async () => {
    if (!validateInputs()) return;
    
    setLoading(true);
    setError('');
    
    try {
      const payload = {
        temperature: parseFloat(weatherData.temperature),
        humidity: parseFloat(weatherData.humidity),
        wind_speed: parseFloat(weatherData.wind_speed),
        solar_radiation: parseFloat(weatherData.solar_radiation),
        location: weatherData.location || 'Unknown Location'
      };
      
      const response = await axios.post(`${API}/calculate-evaporation`, payload);
      setEvaporationResult(response.data);
      
      // Also calculate storage planning
      const storageResponse = await axios.post(`${API}/calculate-storage-planning?surface_area=${surfaceArea}`, payload);
      setStoragePlanningResult(storageResponse.data);
      
      // Refresh history
      fetchHistory();
      
    } catch (err) {
      setError('Error calculating evaporation: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setWeatherData({
      temperature: '',
      humidity: '',
      wind_speed: '',
      solar_radiation: '',
      location: ''
    });
    setSurfaceArea('1000');
    setEvaporationResult(null);
    setStoragePlanningResult(null);
    setError('');
  };

  // Prepare chart data
  const getSeasonalChartData = () => {
    if (!storagePlanningResult) return [];
    
    const seasons = storagePlanningResult.seasonal_analysis;
    return Object.entries(seasons).map(([season, data]) => ({
      season: season.charAt(0).toUpperCase() + season.slice(1),
      evaporation: data.seasonal_total_loss,
      daily_rate: data.daily_evaporation_loss,
      factor: data.percentage_factor
    }));
  };

  const getComponentsChartData = () => {
    if (!evaporationResult) return [];
    
    const components = evaporationResult.penman_components;
    return [
      { name: 'Radiation Component', value: components.radiation_component, color: COLORS[0] },
      { name: 'Aerodynamic Component', value: components.aerodynamic_component, color: COLORS[1] }
    ];
  };

  const getHistoryChartData = () => {
    return history.map((item, index) => ({
      calculation: `#${index + 1}`,
      evaporation_rate: item.evaporation_rate,
      temperature: item.weather_input.temperature,
      humidity: item.weather_input.humidity
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <DropletIcon className="h-8 w-8 text-blue-600" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900">Penman Evaporation Calculator</h1>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Advanced evaporation rate calculation using the original Penman equation with comprehensive storage planning analysis
          </p>
        </div>

        <Tabs defaultValue="calculator" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="calculator" className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Calculator
            </TabsTrigger>
            <TabsTrigger value="results" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Results & Analysis
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calculator" className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Input Form */}
              <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-t-lg">
                  <CardTitle className="flex items-center gap-2">
                    <CloudIcon className="h-5 w-5" />
                    Weather Parameters
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  {error && (
                    <Alert className="border-red-200 bg-red-50">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-800">
                        {error}
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="temperature" className="flex items-center gap-2">
                        <Sun className="h-4 w-4 text-orange-500" />
                        Temperature (°C)
                      </Label>
                      <Input
                        id="temperature"
                        name="temperature"
                        type="number"
                        placeholder="25.0"
                        value={weatherData.temperature}
                        onChange={handleInputChange}
                        data-testid="temperature-input"
                        className="focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="humidity" className="flex items-center gap-2">
                        <DropletIcon className="h-4 w-4 text-blue-500" />
                        Humidity (%)
                      </Label>
                      <Input
                        id="humidity"
                        name="humidity"
                        type="number"
                        placeholder="60.0"
                        value={weatherData.humidity}
                        onChange={handleInputChange}
                        data-testid="humidity-input"
                        className="focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="wind_speed" className="flex items-center gap-2">
                        <Wind className="h-4 w-4 text-gray-500" />
                        Wind Speed (m/s)
                      </Label>
                      <Input
                        id="wind_speed"
                        name="wind_speed"
                        type="number"
                        placeholder="2.0"
                        value={weatherData.wind_speed}
                        onChange={handleInputChange}
                        data-testid="wind-speed-input"
                        className="focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="solar_radiation" className="flex items-center gap-2">
                        <Sun className="h-4 w-4 text-yellow-500" />
                        Solar Radiation (MJ/m²/day)
                      </Label>
                      <Input
                        id="solar_radiation"
                        name="solar_radiation"
                        type="number"
                        placeholder="15.0"
                        value={weatherData.solar_radiation}
                        onChange={handleInputChange}
                        data-testid="solar-radiation-input"
                        className="focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="location" className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-green-500" />
                      Location (Optional)
                    </Label>
                    <Input
                      id="location"
                      name="location"
                      type="text"
                      placeholder="e.g., Agricultural Station, City"
                      value={weatherData.location}
                      onChange={handleInputChange}
                      data-testid="location-input"
                      className="focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <Label htmlFor="surface_area" className="flex items-center gap-2">
                      <Waves className="h-4 w-4 text-teal-500" />
                      Reservoir Surface Area (m²)
                    </Label>
                    <Input
                      id="surface_area"
                      type="number"
                      placeholder="1000"
                      value={surfaceArea}
                      onChange={(e) => setSurfaceArea(e.target.value)}
                      data-testid="surface-area-input"
                      className="focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="flex gap-3 pt-4">
                    <Button 
                      onClick={calculateEvaporation} 
                      disabled={loading}
                      className="flex-1 bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 transition-all duration-200"
                      data-testid="calculate-button"
                    >
                      {loading ? 'Calculating...' : 'Calculate Evaporation'}
                    </Button>
                    
                    <Button 
                      onClick={resetForm} 
                      variant="outline"
                      className="border-gray-300 hover:bg-gray-50"
                      data-testid="reset-button"
                    >
                      Reset
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Results Preview */}
              <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-teal-500 to-green-500 text-white rounded-t-lg">
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Quick Preview
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  {evaporationResult ? (
                    <div className="space-y-4">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-blue-600" data-testid="evaporation-rate-display">
                          {evaporationResult.evaporation_rate} mm/day
                        </div>
                        <p className="text-gray-600">Evaporation Rate</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="bg-blue-50 p-3 rounded-lg">
                          <div className="font-semibold text-blue-800">Radiation Component</div>
                          <div className="text-blue-600">{evaporationResult.penman_components.radiation_component} mm/day</div>
                        </div>
                        <div className="bg-teal-50 p-3 rounded-lg">
                          <div className="font-semibold text-teal-800">Aerodynamic Component</div>
                          <div className="text-teal-600">{evaporationResult.penman_components.aerodynamic_component} mm/day</div>
                        </div>
                      </div>
                      
                      {storagePlanningResult && (
                        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                          <h4 className="font-semibold text-green-800 mb-2">Storage Planning</h4>
                          <div className="text-2xl font-bold text-green-600" data-testid="reservoir-capacity-display">
                            {storagePlanningResult.reservoir_capacity_needed} m³
                          </div>
                          <p className="text-green-700 text-sm">Recommended Reservoir Capacity</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      <Calculator className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>Enter weather parameters and click calculate to see results</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="results" className="space-y-8">
            {evaporationResult && storagePlanningResult ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Detailed Evaporation Results */}
                <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                  <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-t-lg">
                    <CardTitle>Evaporation Analysis</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{evaporationResult.evaporation_rate}</div>
                        <div className="text-sm text-blue-800">mm/day</div>
                      </div>
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">{(evaporationResult.evaporation_rate * 365).toFixed(1)}</div>
                        <div className="text-sm text-purple-800">mm/year</div>
                      </div>
                    </div>

                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={getComponentsChartData()}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {getComponentsChartData().map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => [`${value} mm/day`, '']} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Saturation Vapor Pressure:</span>
                        <span className="font-semibold">{evaporationResult.penman_components.saturation_vapor_pressure} kPa</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Actual Vapor Pressure:</span>
                        <span className="font-semibold">{evaporationResult.penman_components.actual_vapor_pressure} kPa</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Vapor Pressure Deficit:</span>
                        <span className="font-semibold">{evaporationResult.penman_components.vapor_pressure_deficit} kPa</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Wind Function:</span>
                        <span className="font-semibold">{evaporationResult.penman_components.wind_function}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Seasonal Analysis */}
                <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                  <CardHeader className="bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-t-lg">
                    <CardTitle>Seasonal Storage Analysis</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-6">
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={getSeasonalChartData()}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="season" />
                          <YAxis />
                          <Tooltip formatter={(value, name) => [
                            name === 'evaporation' ? `${value} m³` : `${value} m³/day`,
                            name === 'evaporation' ? 'Seasonal Loss' : 'Daily Loss'
                          ]} />
                          <Bar dataKey="evaporation" fill={COLORS[0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <div className="text-xl font-bold text-green-600">{storagePlanningResult.water_balance.annual_evaporation_loss}</div>
                        <div className="text-sm text-green-800">Annual Loss (m³)</div>
                      </div>
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <div className="text-xl font-bold text-blue-600">{storagePlanningResult.reservoir_capacity_needed}</div>
                        <div className="text-sm text-blue-800">Required Capacity (m³)</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Irrigation Recommendations */}
                <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm lg:col-span-2">
                  <CardHeader className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-t-lg">
                    <CardTitle>Irrigation Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {storagePlanningResult.irrigation_recommendations.map((recommendation, index) => (
                        <div key={index} className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                          <h4 className="font-semibold text-orange-800 mb-2">{recommendation.period}</h4>
                          <div className="space-y-1 text-sm">
                            <div>
                              <span className="text-orange-600">Frequency:</span>
                              <div className="font-medium">{recommendation.irrigation_frequency}</div>
                            </div>
                            <div>
                              <span className="text-orange-600">Requirement:</span>
                              <Badge variant="outline" className="ml-1 border-orange-300 text-orange-700">
                                {recommendation.water_requirement}
                              </Badge>
                            </div>
                            <div className="text-xs text-orange-700 mt-2">
                              {recommendation.evaporation_consideration}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-12">
                <TrendingUp className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg">No results to display</p>
                <p className="text-sm">Calculate evaporation first to see detailed analysis</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-8">
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-t-lg">
                <CardTitle>Calculation History</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {history.length > 0 ? (
                  <div className="space-y-6">
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={getHistoryChartData()}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="calculation" />
                          <YAxis />
                          <Tooltip />
                          <Line 
                            type="monotone" 
                            dataKey="evaporation_rate" 
                            stroke={COLORS[0]} 
                            strokeWidth={2}
                            name="Evaporation Rate (mm/day)"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {history.slice(0, 6).map((item, index) => (
                        <div key={item.id || index} className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                          <div className="flex justify-between items-start mb-2">
                            <Badge variant="outline" className="border-purple-300 text-purple-700">
                              #{index + 1}
                            </Badge>
                            <div className="text-right">
                              <div className="font-bold text-purple-600">{item.evaporation_rate} mm/day</div>
                            </div>
                          </div>
                          <div className="text-xs text-purple-700 space-y-1">
                            <div>Temp: {item.weather_input.temperature}°C</div>
                            <div>Humidity: {item.weather_input.humidity}%</div>
                            <div>Wind: {item.weather_input.wind_speed} m/s</div>
                            {item.weather_input.location && (
                              <div>Location: {item.weather_input.location}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-12">
                    <BarChart3 className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg">No calculation history</p>
                    <p className="text-sm">Your previous calculations will appear here</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
};

export default App;