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
 * Utility to generate a unique hex color for each county from a predefined palette.
 */
const colorPalette = [
  '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080',
  '#FFC0CB', '#A52A2A', '#808080', '#000000', '#FFFFFF', '#C0C0C0', '#800000', '#808000',
  '#008000', '#008080', '#000080', '#FF6347', '#40E0D0', '#EE82EE', '#90EE90', '#DDA0DD',
  '#98FB98', '#F0E68C', '#DDA0DD', '#B0E0E6', '#AFEEEE', '#F5DEB3', '#DEB887', '#D2B48C',
  '#BC8F8F', '#F4A460', '#D2691E', '#CD853F', '#A0522D', '#8B4513', '#696969', '#2F4F4F',
  '#708090', '#778899', '#B0C4DE', '#87CEEB', '#87CEFA', '#4682B4', '#4169E1', '#6495ED',
  '#1E90FF', '#00BFFF', '#87CEFA', '#ADD8E6', '#B0E0E6', '#AFEEEE', '#00CED1', '#48D1CC',
  '#20B2AA', '#5F9EA0', '#66CDAA', '#7FFFD4', '#006400', '#228B22', '#32CD32', '#00FF00',
  '#7FFF00', '#7CFC00', '#ADFF2F', '#9ACD32', '#6B8E23', '#556B2F', '#808000', '#BDB76B',
  '#EEE8AA', '#F0E68C', '#FFD700', '#FFA500', '#FF8C00', '#FF7F50', '#FF6347', '#FF4500',
  '#DC143C', '#B22222', '#A0522D', '#8B0000', '#800000', '#FF1493', '#FF69B4', '#FFC0CB',
  '#FFB6C1', '#FFA07A', '#FA8072', '#E9967A', '#F08080', '#CD5C5C', '#DC143C', '#B22222',
  '#A0522D', '#8B0000', '#800000', '#FF1493', '#FF69B4', '#FFC0CB', '#FFB6C1', '#FFA07A',
  '#FA8072', '#E9967A', '#F08080', '#CD5C5C', '#DC143C', '#B22222', '#A0522D', '#8B0000',
  '#800000', '#FF1493', '#FF69B4', '#FFC0CB', '#FFB6C1', '#FFA07A', '#FA8072', '#E9967A',
  '#F08080', '#CD5C5C', '#DC143C', '#B22222', '#A0522D', '#8B0000', '#800000', '#FF1493',
  '#FF69B4', '#FFC0CB', '#FFB6C1', '#FFA07A', '#FA8072', '#E9967A', '#F08080', '#CD5C5C'
];

let colorIndex = 0;
function generateUniqueColor() {
  const color = colorPalette[colorIndex % colorPalette.length];
  colorIndex++;
  return color;
}

/**
 * Endpoint to retrieve all county GeoJSON features with boundaries and colors.
 * @route GET /api/counties/geojson
 * @returns {Object} - GeoJSON FeatureCollection with bounds data.
 */
app.get("/api/counties/geojson", async (req, res) => {
  try {
    const counties = ee.FeatureCollection(countyCollectionPath);

    // CORRECTED: Use ee.Geometry.bounds().coordinates() and ee.List.flatten()
    const collectionWithProps = counties.map((feature) => {
        // Get the bounding box geometry
        const boundsGeometry = feature.geometry().bounds();
        
        // Extract the corner coordinates as a 4-element EE List: [minLon, minLat, maxLon, maxLat]
        // This is necessary to correctly extract bounds data on the EE server side.
        const bbox = ee.List(boundsGeometry.coordinates().get(0)).flatten(); 
        
        return feature
          .set('bbox', bbox)
          .set('color', generateUniqueColor()); // Assign a unique color
    });

    // 2. Fetch the GeoJSON representation of the entire collection
    const geojsonData = await collectionWithProps.getInfo();

    // 3. Extract only the necessary list for the dropdown (synchronous call to speed up response)
    const countyList = await collectionWithProps
      .aggregate_array("COUNTY_NAM")
      .sort()
      .getInfo();

    res.json({ geojson: geojsonData, countyList });
  } catch (err) {
    console.error("Error fetching county GeoJSON:", err);
    res.status(500).json({ error: `Failed to fetch county boundaries for display. Details: ${err.message}` });
  }
});

/**
 * Endpoint to get a GeoJSON download URL for a specific county or the whole collection.
 * @route GET /api/download/geojson/:countyName?
 * @param {string} countyName - Optional county name.
 * @returns {Object} - An object containing the temporary download URL.
 */
app.get("/api/download/geojson", async (req, res) => {
  const countyName = req.query.countyName;

  try {
    let collection = ee.FeatureCollection(countyCollectionPath);
    let fileName = "kenya_counties_all";
    
    if (countyName && countyName !== 'Whole Area') {
      collection = collection.filter(ee.Filter.eq("COUNTY_NAM", countyName));
      fileName = countyName.replace(/\s/g, '_').toLowerCase() + '_boundary';
    }

    // Use ee.FeatureCollection.getDownloadURL to generate a temporary download link
    const downloadUrl = await collection.getDownloadURL({
      format: 'geojson',
      filename: fileName,
    });

    res.json({ downloadUrl });
  } catch (err) {
    console.error("Error generating download URL:", err);
    res.status(500).json({ error: "Failed to generate GeoJSON download link." });
  }
});


/**
 * Endpoint to generate a Sentinel-2 map tile URL for a specific analysis.
 * (Logic is sound and remains the same)
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
    // Filter by name or use a default Point geometry
    aoi = countyName ? 
          counties.filter(ee.Filter.eq("COUNTY_NAM", countyName)).geometry() : 
          ee.Geometry.Point([37.65, -0.05]).buffer(50000); // Use a buffered point for a general area
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

    // --- Visualization logic (as previously defined) ---
    switch (enhancement) {
      case "true_color":
        visParams = { bands: ["B4", "B3", "B2"], min: 0, max: 3000, gamma: 1.4, };
        legendInfo = { title: "True Color", description: "Natural appearance." };
        break;

      case "false_color":
        visParams = { bands: ["B8", "B4", "B3"], min: 0, max: 3000, gamma: 1.4, };
        legendInfo = { title: "False Color (Vegetation)", description: "Healthy vegetation is red." };
        break;

      case "agriculture":
        visParams = { bands: ["B11", "B8", "B2"], min: 0, max: 3000, gamma: 1.4, };
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
          title: "NDVI",
          classes: [
            { color: "#d73027", label: "Non-Vegetation (-1.0 to -0.2)" },
            { color: "#fc8d59", label: "Stressed Vegetation (-0.2 to 0.2)" },
            { color: "#fee08b", label: "Moderate Vegetation (0.2 to 0.4)" },
            { color: "#d9ef8b", label: "Healthy Vegetation (0.4 to 0.6)" },
            { color: "#99d594", label: "Very Healthy Vegetation (0.6 to 1.0)" }
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
          title: "NDMI",
          classes: [
            { color: "#a50026", label: "Low Moisture" },
            { color: "#74add1", label: "Saturated/Water" }
          ],
        };
        break;

      case "urban":
        visParams = { bands: ["B12", "B11", "B4"], min: 0, max: 3000, gamma: 1.4, };
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
