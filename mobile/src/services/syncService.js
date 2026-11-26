
import NetInfo from "@react-native-community/netinfo";
import { api } from "./api";

import {
  getPendingReadings,
  markReadingsSynced
} from "../database/readingRepository";

let syncing = false;

export const syncReadings = async () => {

  if (syncing) return;

  syncing = true;

  try {

    const network = await NetInfo.fetch();

    if (!network.isConnected ||
        network.isInternetReachable === false) {
      return;
    }

    const readings = await getPendingReadings();

    if (!readings.length) return;

    const response = await api.post(
      "/readings/sync",
      { readings }
    );

    if (response.data.success) {

      const acknowledged =
        response.data.acknowledged;

      await markReadingsSynced(acknowledged);
    }

  } catch (error) {

    console.log(
      "Sync failed:",
      error.message
    );

  } finally {
    syncing = false;
  }
};
