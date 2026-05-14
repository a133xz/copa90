# COPA90 Ingest Tool

A professional, high-performance media ingestion and backup application built for creative workflows. This tool streamlines the process of offloading media from SD cards to production drives, ensuring organized folder structures and data integrity.

## Features

- **Automated Ingestion**: Offload SD cards with a single click.
- **Sequential Roll Numbering**: Automatically calculates the next roll number across all shoot days.
- **Drive Backups**: Integrated drive-to-drive mirroring for redundant backups.
- **Creative-Friendly UI**: A sleek, high-contrast dark mode interface inspired by IBM Carbon design principles.
- **Built for macOS**: Leverages Tauri for a native desktop experience.
- **Reliable Core**: Powered by robust rsync logic for safe and efficient file transfers.

## Global Sequential Folder Structure

The application automatically organizes footage into a standardized hierarchy. Roll numbers are tracked globally across all days, ensuring that a new shoot day continues from the last used number.

```mermaid
graph TD
    Root["Destination Drive"] --> D1["Day_01"]
    Root --> D2["Day_02"]

    D1 --> ACAM1["A_CAM"]
    D2 --> ACAM2["A_CAM"]

    ACAM1 --> A001["A001"]
    ACAM1 --> A002["A002"]

    ACAM2 --> A003["A003 (Continues from Day 1)"]
```

## Tech Stack

- **Core**: [Tauri v2](https://tauri.app/)
- **Frontend**: [React](https://reactjs.org/) + [TypeScript](https://www.typescriptlang.org/)
- **Styling**: Vanilla CSS + [Framer Motion](https://www.framer.com/motion/)
- **Logic**: Custom Bash scripts (ingest.sh, backup.sh)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/a133xz/copa90.git
   cd copa90
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Run in development mode:
   ```bash
   npm run tauri dev
   ```

### Building for Production

To create a signed macOS application:

```bash
npm run tauri build
```

## Future UI Proposal

As the tool evolves, we aim to implement a comprehensive dashboard for real-time queue management and multi-drive monitoring.

<img src="./public/mockup.png" width="500" alt="COPA90 UI Proposal" />

---

_Created for the COPA90 Production Team._
