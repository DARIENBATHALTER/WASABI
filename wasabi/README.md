# WASABI - Wide Array Student Analytics and Benchmarking Interface

A comprehensive data analytics platform for charter schools, designed to aggregate multiple data sources into unified student profiles for better educational insights.

## Features

- **Student Profile Cards**: Comprehensive view of individual student data
- **Multi-Source Data Import**: Support for FOCUS, iReady, FAST, STAR, and Achieve3000
- **Visual Analytics**: Charts and graphs for performance trends
- **Early Warning System**: Flag students approaching academic crisis
- **Class & Grade Analytics**: Group-based performance analysis
- **Report Generation**: Export customized student reports
- **Privacy-First**: All data processing happens locally in the browser

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd wasabi
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser to `http://localhost:5173`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Data Sources

WASABI supports importing CSV files from the following educational platforms:

- **FOCUS**: Student enrollment, grades, attendance
- **iReady**: Reading and math diagnostic assessments
- **FAST**: Florida Assessment of Student Thinking
- **STAR**: Renaissance reading and math assessments
- **Achieve3000**: Literacy assessment data

## Technology Stack

- **Frontend**: React 19 with TypeScript
- **Build Tool**: Vite
- **Styling**: TailwindCSS
- **State Management**: Zustand
- **Database**: IndexedDB (via Dexie)
- **Charts**: Recharts
- **Routing**: React Router v6

## Privacy & Security

- No data is sent to external servers
- All CSV processing happens in the browser
- Data is stored locally in IndexedDB
- Optional encryption for stored data

## Development

See [ARCHITECTURE.md](../ARCHITECTURE.md) for detailed technical documentation.

## License

Proprietary - All rights reserved
