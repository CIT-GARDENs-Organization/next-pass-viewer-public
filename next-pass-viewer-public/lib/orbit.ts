import { eciToEcf, ecfToLookAngles, gstime, propagate, twoline2satrec, type SatRec } from 'satellite.js';

export interface SatelliteDefinition {
  id: number;
  name: string;
  tle1: string;
  tle2: string;
}

export interface GroundStationDefinition {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  altitude_m: number;
}

export interface OrbitComputationOptions {
  standardTime: Date;
  viewLength: number;
  windowMinutes?: number;
  stepSeconds?: number;
  satelliteFilter?: string[];
}

export interface OrbitPassResult {
  aos_time: string;
  los_time: string;
  max_elevation: number;
  aos_azimuth: number;
  max_azimuth: number;
  los_azimuth: number;
  satellite_id: number;
  groundstation_id: number;
}

interface WorkingPass {
  aos: Date;
  los: Date;
  maxElevation: number;
  aosAzimuth: number;
  maxAzimuth: number;
  losAzimuth: number;
}

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

function createSatrec(definition: SatelliteDefinition): SatRec | null {
  try {
    return twoline2satrec(definition.tle1, definition.tle2);
  } catch {
    return null;
  }
}

function toObserverGd(station: GroundStationDefinition) {
  return {
    latitude: station.latitude * DEG_TO_RAD,
    longitude: station.longitude * DEG_TO_RAD,
    height: station.altitude_m / 1000,
  } as const;
}

function buildPassRecord(
  pass: WorkingPass,
  satelliteId: number,
  groundstationId: number
): OrbitPassResult {
  return {
    aos_time: pass.aos.toISOString(),
    los_time: pass.los.toISOString(),
    max_elevation: Number(pass.maxElevation.toFixed(2)),
    aos_azimuth: Number(pass.aosAzimuth.toFixed(2)),
    max_azimuth: Number(pass.maxAzimuth.toFixed(2)),
    los_azimuth: Number(pass.losAzimuth.toFixed(2)),
    satellite_id: satelliteId,
    groundstation_id: groundstationId,
  };
}

export function computeOrbitPasses(
  satellites: SatelliteDefinition[],
  groundstations: GroundStationDefinition[],
  options: OrbitComputationOptions
): OrbitPassResult[] {
  const { standardTime, viewLength, windowMinutes = 12 * 60, stepSeconds = 30, satelliteFilter } = options;
  const startTime = new Date(standardTime);
  const endTime = new Date(startTime.getTime() + windowMinutes * 60 * 1000);
  const maxNeeded = Math.max(viewLength * groundstations.length, viewLength * 2);

  const passes: OrbitPassResult[] = [];

  for (const satellite of satellites) {
    if (satelliteFilter && satelliteFilter.length > 0 && !satelliteFilter.includes(satellite.name)) {
      continue;
    }

    const satrec = createSatrec(satellite);
    if (!satrec) {
      continue;
    }

    for (const station of groundstations) {
      const observerGd = toObserverGd(station);
      let workingPass: WorkingPass | null = null;
      let lastAzimuth = 0;

      for (let timeMs = startTime.getTime(); timeMs <= endTime.getTime(); timeMs += stepSeconds * 1000) {
        const current = new Date(timeMs);
        const gmst = gstime(current);
        const propagation = propagate(satrec, current);
        if (!propagation || !propagation.position) {
          continue;
        }
        const positionEci = propagation.position;

        if (!positionEci) {
          continue;
        }

        const positionEcf = eciToEcf(positionEci, gmst);
        const lookAngles = ecfToLookAngles(observerGd, positionEcf);
        const elevation = lookAngles.elevation * RAD_TO_DEG;
        const azimuth = (lookAngles.azimuth * RAD_TO_DEG + 360) % 360;
        lastAzimuth = azimuth;

        if (elevation > 0) {
          if (!workingPass) {
            workingPass = {
              aos: current,
              los: current,
              maxElevation: elevation,
              aosAzimuth: azimuth,
              maxAzimuth: azimuth,
              losAzimuth: azimuth,
            };
          } else {
            workingPass.los = current;
          }

          if (elevation > workingPass.maxElevation) {
            workingPass.maxElevation = elevation;
            workingPass.maxAzimuth = azimuth;
          }

          workingPass.losAzimuth = azimuth;
        } else if (workingPass) {
          workingPass.los = current;
          workingPass.losAzimuth = azimuth;
          passes.push(buildPassRecord(workingPass, satellite.id, station.id));
          workingPass = null;

          if (passes.length >= maxNeeded) {
            break;
          }
        }
      }

      if (workingPass) {
        workingPass.losAzimuth = lastAzimuth;
        passes.push(buildPassRecord(workingPass, satellite.id, station.id));
        workingPass = null;
      }

      if (passes.length >= maxNeeded) {
        break;
      }
    }

    if (passes.length >= maxNeeded) {
      break;
    }
  }

  return passes
    .sort((a, b) => new Date(a.aos_time).getTime() - new Date(b.aos_time).getTime())
    .slice(0, Math.max(viewLength, 1));
}
