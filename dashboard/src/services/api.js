
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api"
});

export const getSessions = async () => {

  const response = await api.get(
    "/sessions/history"
  );

  return response.data.sessions;
};

export const getLatestReadings = async () => {

  // This endpoint will be added to the backend.
  const response = await api.get(
    "/readings/latest"
  );

  return response.data.readings;
};
