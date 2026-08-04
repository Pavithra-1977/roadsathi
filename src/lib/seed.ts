import type { LatLng, Mechanic, PartsShop } from "./types";

/**
 * Demo roster.
 *
 * Mechanics and parts shops are placed at fixed offsets around whatever
 * location the SOS is raised from. That means the demo works from any city
 * in the world without reseeding the database - the judge's own GPS location
 * becomes the centre of the map.
 *
 * In production these rows live in Postgres with a PostGIS index and this
 * function is replaced by a `ST_DWithin` query. The interface is identical.
 */

const KM = 1 / 111; // rough degrees per km

interface MechanicSeed extends Omit<Mechanic, "location"> {
  dLatKm: number;
  dLngKm: number;
}

const MECHANIC_SEEDS: MechanicSeed[] = [
  {
    id: "m1",
    name: "Ravi Kumar",
    shopName: "Sri Balaji Auto Works",
    phone: "+91 98490 11223",
    verified: true,
    rating: 4.8,
    jobsCompleted: 312,
    skills: ["tyre", "engine", "battery", "electrical", "cooling", "fuel", "general"],
    vehicleTypes: ["car", "suv", "auto", "bike"],
    online: true,
    jobsLast7Days: 2,
    arrivalVehicle: "Hero Splendor",
    plateNumber: "TS 09 EF 4412",
    dLatKm: 1.6,
    dLngKm: -1.1,
  },
  {
    id: "m2",
    name: "Imran Sheikh",
    shopName: "Highway Tyre Point",
    phone: "+91 90000 44551",
    verified: true,
    rating: 4.6,
    jobsCompleted: 189,
    skills: ["tyre", "suspension", "general"],
    vehicleTypes: ["car", "suv", "truck", "bike", "auto"],
    online: true,
    jobsLast7Days: 11,
    arrivalVehicle: "Bajaj Pulsar",
    plateNumber: "TS 07 GH 8890",
    dLatKm: -2.4,
    dLngKm: 1.9,
  },
  {
    id: "m3",
    name: "Suresh Reddy",
    shopName: "Reddy Motors & Electricals",
    phone: "+91 93910 77324",
    verified: true,
    rating: 4.9,
    jobsCompleted: 501,
    skills: ["electrical", "battery", "engine", "brakes", "hydraulics", "general"],
    vehicleTypes: ["car", "suv", "truck"],
    online: true,
    jobsLast7Days: 1,
    arrivalVehicle: "Maruti Eeco (mobile van)",
    plateNumber: "TS 08 AB 1190",
    dLatKm: 3.8,
    dLngKm: 2.7,
  },
  {
    id: "m4",
    name: "Manoj Yadav",
    shopName: "Yadav Two-Wheeler Service",
    phone: "+91 96420 55018",
    verified: true,
    rating: 4.4,
    jobsCompleted: 97,
    skills: ["two-wheeler", "tyre", "electrical", "general"],
    vehicleTypes: ["bike", "auto"],
    online: true,
    jobsLast7Days: 0,
    arrivalVehicle: "TVS Raider",
    plateNumber: "TS 12 CD 3376",
    dLatKm: -1.2,
    dLngKm: -2.8,
  },
  {
    id: "m5",
    name: "Prakash Naidu",
    shopName: "Naidu Recovery & Towing",
    phone: "+91 88860 22947",
    verified: true,
    rating: 4.7,
    jobsCompleted: 244,
    skills: ["recovery", "towing", "transmission", "suspension", "general"],
    vehicleTypes: ["car", "suv", "truck"],
    online: true,
    jobsLast7Days: 4,
    arrivalVehicle: "Mahindra Bolero flatbed",
    plateNumber: "TS 11 KL 6621",
    dLatKm: 5.9,
    dLngKm: -3.4,
  },
  {
    id: "m6",
    name: "Arjun Pillai",
    shopName: "Nightshift Garage (24x7)",
    phone: "+91 99590 66702",
    verified: true,
    rating: 4.5,
    jobsCompleted: 156,
    skills: ["engine", "cooling", "fuel", "locksmith", "electrical", "general"],
    vehicleTypes: ["car", "suv", "bike", "auto", "truck"],
    online: true,
    jobsLast7Days: 3,
    arrivalVehicle: "Royal Enfield Himalayan",
    plateNumber: "TS 10 MN 7735",
    dLatKm: -4.1,
    dLngKm: 3.3,
  },
];

interface ShopSeed extends Omit<PartsShop, "location"> {
  dLatKm: number;
  dLngKm: number;
}

const SHOP_SEEDS: ShopSeed[] = [
  {
    id: "s1",
    name: "Balaji Spare Parts",
    openNow: true,
    open24h: false,
    phone: "+91 98490 11224",
    inventory: {
      "tube-patch-kit": 12,
      "valve-stem": 30,
      "spark-plug": 18,
      "fuse-assorted": 40,
      "coolant-1l": 9,
      "drive-belt": 4,
      relay: 11,
      "battery-terminal": 7,
    },
    dLatKm: 1.9,
    dLngKm: -0.7,
  },
  {
    id: "s2",
    name: "Highway Tyre & Battery Depot",
    openNow: true,
    open24h: true,
    phone: "+91 90000 44552",
    inventory: {
      "tyre-replacement": 22,
      "wheel-nut": 60,
      "battery-12v": 8,
      "battery-terminal": 15,
      "tube-patch-kit": 25,
      "valve-stem": 44,
    },
    dLatKm: -2.1,
    dLngKm: 2.2,
  },
  {
    id: "s3",
    name: "Reddy Auto Electricals",
    openNow: true,
    open24h: false,
    phone: "+91 93910 77325",
    inventory: {
      alternator: 3,
      "starter-motor": 5,
      solenoid: 9,
      "ignition-coil": 6,
      "fuse-assorted": 55,
      "wire-loom": 12,
      relay: 20,
      "battery-12v": 4,
    },
    dLatKm: 4.0,
    dLngKm: 2.4,
  },
  {
    id: "s4",
    name: "NH Fuel Stop & Mini Mart",
    openNow: true,
    open24h: true,
    phone: "+91 91000 30001",
    inventory: { "fuel-5l": 99, "coolant-1l": 14, "brake-fluid": 10 },
    dLatKm: 2.6,
    dLngKm: 3.9,
  },
  {
    id: "s5",
    name: "Sai Radiator & Hose Works",
    openNow: false,
    open24h: false,
    phone: "+91 94910 88123",
    inventory: {
      "radiator-hose": 16,
      "radiator-cap": 21,
      "hose-clamp": 48,
      "coolant-1l": 20,
      "tensioner-pulley": 5,
      "drive-belt": 7,
    },
    dLatKm: -3.6,
    dLngKm: -1.4,
  },
  {
    id: "s6",
    name: "Yadav Bike Spares",
    openNow: true,
    open24h: false,
    phone: "+91 96420 55019",
    inventory: {
      "chain-link": 30, "drive-chain": 9, sprocket: 12,
      "spark-plug": 25, "tube-patch-kit": 33,
    },
    dLatKm: -1.4,
    dLngKm: -2.5,
  },
  {
    id: "s7",
    name: "Metro Brake & Clutch House",
    openNow: true,
    open24h: false,
    phone: "+91 97000 41288",
    inventory: {
      "brake-fluid": 26, "brake-pad-set": 14, "brake-hose": 10,
      "clutch-plate": 6, "clutch-cable": 18, "clutch-fluid": 12,
      "ball-joint": 8, "tie-rod": 9, "shock-absorber": 5,
    },
    dLatKm: 3.1,
    dLngKm: -4.2,
  },
];

function offset(origin: LatLng, dLatKm: number, dLngKm: number): LatLng {
  const lngScale = Math.max(0.2, Math.cos((origin.lat * Math.PI) / 180));
  return {
    lat: Number((origin.lat + dLatKm * KM).toFixed(6)),
    lng: Number((origin.lng + (dLngKm * KM) / lngScale).toFixed(6)),
  };
}

export function mechanicsNear(origin: LatLng): Mechanic[] {
  return MECHANIC_SEEDS.map(({ dLatKm, dLngKm, ...m }) => ({
    ...m,
    location: offset(origin, dLatKm, dLngKm),
  }));
}

export function shopsNear(origin: LatLng): PartsShop[] {
  return SHOP_SEEDS.map(({ dLatKm, dLngKm, ...s }) => ({
    ...s,
    location: offset(origin, dLatKm, dLngKm),
  }));
}
