<img width="1915" height="1033" alt="image" src="https://github.com/user-attachments/assets/d0158c00-1b44-49ba-9a49-c630628031fb" />
# 🌍 Advanced Sentinel-2 Geospatial Dashboard

An interactive, multi-view web application for analyzing Sentinel-2 satellite imagery using the Google Earth Engine (GEE) API and a Node.js backend. This dashboard allows users to perform comparative analysis, visualize different spectral indices, and manage multiple data layers for various Kenyan counties.

## ✨ Features

-   **Multi-View Layout**: Compare up to four different Sentinel-2 layers side-by-side.
-   **Dynamic Layer Management**: Add, remove, and toggle visibility for multiple layers within each map view.
-   **Interactive Table of Contents**: A dedicated control panel for each map view to manage layers and adjust parameters.
-   **Customizable Analysis**: Select specific counties, years, and cloud cover percentages for tailored imagery.
-   **Advanced Visualizations**:
    -   **True Color** (B4, B3, B2) for natural-looking imagery.
    -   **False Color** (B8, B4, B3) to highlight vegetation.
    -   **Agriculture** (B11, B8, B2) for crop health monitoring.
    -   **Urban** (B12, B11, B4) to distinguish urban areas.
    -   **NDVI** (Normalized Difference Vegetation Index) for vegetation health analysis, with a custom, accurate color palette.
    -   **NDMI** (Normalized Difference Moisture Index) for measuring water content.
-   **Synchronized Views**: All map views are synchronized for a seamless comparative experience, with coordinated panning and zooming.
-   **Dynamic Legends**: Legends are automatically generated and updated based on the selected analysis (e.g., NDVI, NDMI).

## 🚀 Getting Started

Follow these instructions to set up and run the project locally.

### Prerequisites

-   **Node.js**: Make sure you have Node.js and npm installed.
-   **Google Earth Engine Account**: You need an active GEE account. If you don't have one, sign up here: [GEE Sign Up](https://earthengine.google.com/signup/).
-   **GEE Service Account**: Create a service account to authenticate with the GEE API. 
    1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
    2.  Create a new project.
    3.  Navigate to **IAM & Admin** > **Service Accounts**.
    4.  Create a new service account.
    5.  Generate a new JSON key for the account and download it.
    6.  Rename the downloaded JSON key file to `key.json` and place it in the root directory of this project.
    7.  **Authorize the service account**: In the GEE Code Editor, share the `projects/ee-celestakim019/assets/counties` asset with your new service account email address, giving it **Reader** permissions.

### Installation

1.  Clone the repository:
    ```bash
    git clone [https://github.com/your-username/your-repo-name.git](https://github.com/your-username/your-repo-name.git)
    cd your-repo-name
    ```
2.  Install the required Node.js packages:
    ```bash
    npm install express @google/earthengine
    ```

### Usage

1.  Start the Node.js server from the root directory:
    ```bash
    npm start
    ```
2.  Open your web browser and navigate to `http://localhost:3000`.

The application will load, and you can begin exploring Sentinel-2 imagery by selecting your desired counties, years, and analysis types from the control panel.

## 📂 Project Structure
