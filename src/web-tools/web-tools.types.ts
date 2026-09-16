export interface GeocodedPlace {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
}

export interface CurrentWeather {
  temperatureC: number;
  windSpeedKph: number;
  weatherCode: number;
}

export interface OpenMeteoGeocodingResponse {
  results?: Array<{
    name: string;
    latitude: number;
    longitude: number;
    country?: string;
  }>;
}

export interface OpenMeteoForecastResponse {
  current: {
    temperature_2m: number;
    weather_code: number;
    wind_speed_10m: number;
  };
}
