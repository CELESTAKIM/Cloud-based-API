// server.js - A robust and feature-rich backend for geospatial analysis
import express from "express";
import ee from "@google/earthengine";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";

// ======================================================================
// 🚀 SERVER SETUP AND CONFIGURATION
// ======================================================================
const app = express();
const PORT = 3000;
app.use(express.json());

// --- File path constants for robust file serving ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const keyPath = path.join(__dirname, "key.json");

// ✅ Serve static files from the root directory
app.use(express.static(__dirname));

// ✅ Serve the main HTML file
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ======================================================================
// 🔐 EARTH ENGINE AUTHENTICATION & INITIALIZATION
// ======================================================================
let eeInitialized = false;

const initializeEarthEngine = async () => {
  if (eeInitialized) return;

  try {
    const privateKey = JSON.parse(await promisify(fs.readFile)(keyPath, "utf8"));
    await promisify(ee.data.authenticateViaPrivateKey)(privateKey);
    console.log("✅ EE authentication successful!");
    ee.initialize(null, null, () => {
      console.log("✅ EE client initialized!");
      eeInitialized = true;
    }, (err) => {
      console.error("❌ EE client initialization failed:", err);
    });
  } catch (e) {
    console.error("❌ Failed to read or parse 'key.json':", e.message);
    process.exit(1);
  }
};

initializeEarthEngine();

// Middleware to ensure EE is initialized before processing requests
app.use((req, res, next) => {
  if (eeInitialized) {
    next();
  } else {
    res.status(503).json({ error: "Earth Engine is not initialized. Please try again in a moment." });
  }
});

// ======================================================================
// 🌍 GEOSPATIAL DATA & API ENDPOINTS
// ======================================================================
const countyCollectionPath = "projects/ee-celestakim019/assets/counties";

/**
 * Endpoint to retrieve a list of all counties.
 * @route GET /api/counties
 * @returns {Array} - Sorted list of county names.
 */
app.get("/api/counties", async (req, res) => {
  try {
    const counties = ee.FeatureCollection(countyCollectionPath);
    const countyList = await counties
      .aggregate_array("COUNTY_NAM")
      .sort()
      .getInfo();
    res.json(countyList);
  } catch (err) {
    console.error("Error fetching county list:", err);
    res.status(500).json({ error: "Failed to fetch county list due to an internal server error." });
  }
});

/**
 * Endpoint to generate a Sentinel-2 map tile URL for a specific analysis.
 * @route POST /api/sentinel
 * @body {Object} - Analysis parameters (year, bands, enhancement, countyName, cloudCover)
 * @returns {Object} - Map ID and legend information.
 */
app.post("/api/sentinel", async (req, res) => {
  const { year, bands, enhancement, countyName, cloudCover } = req.body;

  if (!year || !bands || !enhancement || !cloudCover) {
    return res.status(400).json({ error: "Missing required parameters." });
  }

  let aoi;
  try {
    const counties = ee.FeatureCollection(countyCollectionPath);
    aoi = countyName ? counties.filter(ee.Filter.eq("COUNTY_NAM", countyName)).first().geometry() : ee.Geometry.Point([37.65, -0.05]);
  } catch (err) {
    console.error("Error retrieving AOI geometry:", err);
    return res.status(404).json({ error: `Could not find a geometry for county: '${countyName}'.` });
  }

  try {
    let imageCollection = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
      .filterBounds(aoi)
      .filterDate(`${year}-01-01`, `${year}-12-31`)
      .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", parseFloat(cloudCover)));

    const count = await imageCollection.size().getInfo();
    if (count === 0) {
      return res.status(404).json({
        error: `No Sentinel-2 imagery found for the specified criteria (Year: ${year}, County: ${countyName}, Cloud Cover: < ${cloudCover}%)`
      });
    }

    let finalImage = imageCollection.median().clip(aoi);
    let visParams = {};
    let legendInfo = { title: "Custom Vis", classes: [] };

    switch (enhancement) {
      case "true_color":
        visParams = {
          bands: ["B4", "B3", "B2"],
          min: 0,
          max: 3000,
          gamma: 1.4,
        };
        legendInfo = { title: "True Color", description: "Natural appearance." };
        break;

      case "false_color":
        visParams = {
          bands: ["B8", "B4", "B3"],
          min: 0,
          max: 3000,
          gamma: 1.4,
        };
        legendInfo = { title: "False Color (Vegetation)", description: "Healthy vegetation is red." };
        break;

      case "agriculture":
        visParams = {
          bands: ["B11", "B8", "B2"],
          min: 0,
          max: 3000,
          gamma: 1.4,
        };
        legendInfo = { title: "Agriculture", description: "Highlights crop health." };
        break;

      case "ndvi":
        finalImage = finalImage.normalizedDifference(["B8", "B4"]).rename("NDVI");
        visParams = {
          min: -0.2,
          max: 0.8,
          palette: ["#d73027", "#fc8d59", "#fee08b", "#d9ef8b", "#99d594", "#4a864d"],
        };
        legendInfo = {
          title: "Normalized Difference Vegetation Index (NDVI)",
          classes: [
            { color: "#d73027", label: "Very Low Vegetation (-0.2 to 0)" },
            { color: "#fc8d59", label: "Low Vegetation (0 to 0.2)" },
            { color: "#fee08b", label: "Medium Vegetation (0.2 to 0.4)" },
            { color: "#d9ef8b", label: "High Vegetation (0.4 to 0.6)" },
            { color: "#99d594", label: "Very High Vegetation (0.6 to 0.8)" },
            { color: "#4a864d", label: "Dense Vegetation (> 0.8)" }
          ],
        };
        break;

      case "moisture_index":
        finalImage = finalImage.normalizedDifference(["B8A", "B11"]).rename("NDMI");
        visParams = {
          min: -0.5,
          max: 0.5,
          palette: ["#a50026", "#d73027", "#f46d43", "#fee090", "#e0f3f8", "#abd9e9", "#74add1"],
        };
        legendInfo = {
          title: "Normalized Difference Moisture Index (NDMI)",
          classes: [
            { color: "#a50026", label: "Low Moisture" },
            { color: "#d73027", label: "Dry Vegetation" },
            { color: "#f46d43", label: "Medium Moisture" },
            { color: "#fee090", label: "High Moisture" },
            { color: "#e0f3f8", label: "Very High Moisture" },
            { color: "#abd9e9", label: "Water" },
            { color: "#74add1", label: "Saturated" }
          ],
        };
        break;

      case "urban":
        visParams = {
          bands: ["B12", "B11", "B4"],
          min: 0,
          max: 3000,
          gamma: 1.4,
        };
        legendInfo = { title: "Urban", description: "Urban areas are cyan/blue." };
        break;

      default:
        return res.status(400).json({ error: "Invalid enhancement type specified." });
    }

    if (enhancement !== "ndvi" && enhancement !== "moisture_index") {
      visParams.bands = bands;
    }

    finalImage.getMap(visParams, (map, err) => {
      if (err) {
        console.error("Earth Engine map generation failed:", err);
        return res.status(500).json({ error: "Failed to generate map tiles. Please check your parameters." });
      }
      res.json({ mapId: map, legendInfo });
    });

  } catch (err) {
    console.error("An unexpected Earth Engine error occurred:", err);
    res.status(500).json({ error: `An unexpected error occurred. Details: ${err.message}` });
  }
});


// ======================================================================
// 🚀 SERVER STARTUP
// ======================================================================
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log("Awaiting Earth Engine client initialization...");
});
