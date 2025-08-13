# Sustainability-Footprint-Tool: Measure & Improve: Personal Carbon Footprint Estimation via Activity Data Parsing, Emission Factor Modelling, and Interactive Sustainability Reporting

A full-stack web application that tracks, calculates, and visualizes sustainability footprints using live data, with client-side charts and PDF export capabilities.

## Features

* Real-Time Data Visualization: Dynamic charts powered by Chart.js for instant sustainability insights.
* PDF Export: Generate detailed footprint reports client-side using jsPDF.
* Progressive Web App (PWA): Offline support and installability via service workers.
* Server API: Node.js backend with environment configuration for secure data management.
* Modular Design: Clear separation of frontend (public) and backend (private/server) logic.

## 🛠Prerequisites

* Node.js 16+ (with npm)
* Modern web browser for PWA features

## Installation

```bash
# Clone the repo
git clone https://github.com/Dancull/Sustainability-Footprint-Tool.git

# Install backend dependencies
cd Sustainability-Footprint-Tool/private
npm install

# Start backend server
npm start

# Open frontend
# Serve the 'public' folder (e.g. using live-server or VS Code Live Server)
```

## Usage

Open the app in your browser via the local server or static host. Interact with the dashboard to view sustainability footprint charts, export reports as PDFs, and use offline features if PWA is installed.

## License

Including a LICENSE file clarifies how others may use, modify, and distribute your code. By choosing an open-source license such as MIT, you grant permission for use under defined terms while protecting your intellectual property and limiting liability.

This project is licensed under the MIT License. See [LICENSE](LICENSE) for full details.

## Project Structure

```plaintext
Sustainability-Footprint-Tool/
├── public/                     # Frontend assets and client scripts
│   ├── app.js                  # Main client app logic
│   ├── chartjs-helper.js       # Chart.js helper functions
│   ├── index.html              # Main HTML page
│   ├── jspdf-helper.js         # jsPDF helper for PDF export
│   ├── manifest.json           # PWA manifest configuration
│   ├── style.css               # Stylesheet
│   └── sw.js                   # Service Worker for PWA
├── private/                    # Backend and server files
│   ├── node_modules/           # Node.js dependencies
│   ├── server/                 # Server source code (Express or similar)
│   ├── .env                    # Environment variables (not committed)
│   ├── index.js                # Server entry point
│   ├── package-lock.json       # Dependency lock file
│   └── package.json            # Project metadata and scripts
├── README.md                   
```

## Roadmap

* Implimentation has been taken care of however need to ensure the full backend works. 

* User authentication (sign in with Google)
* Cloud sync, saving/loading data
* AI-driven recommendations and summaries
* Leaderboard, group/family features
* Location-based recommendations (weather, transport)
* Streaks, points, badges that depend on backend data

## Author

* **Daniel Cullinane** – [daniel.cullinane@outlook.com](mailto:daniel.cullinane@outlook.com)
* GitHub: [@dancull](https://github.com/dancull)
