
export const sensorState = {
  connected: true
};

export const disconnectSensor = () => {
  sensorState.connected = false;
};

export const reconnectSensor = () => {
  sensorState.connected = true;
};
