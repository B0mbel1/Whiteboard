# Collaborative Whiteboard

A real-time collaborative whiteboard web application built with **React** and **Node.js**. It allows multiple users to draw, add multimedia, and communicate simultaneously on a shared canvas.

## Features

Based on the project structure, the application includes:
* **Freehand Drawing & Tools:** Brush, pencil, and eraser tools with customizable sizes and color picker (`Toolbar`, `Canvas`)[cite: 1].
* **Interactive Canvas Elements:** Support for shapes, sticky notes, text blocks, images, GIFs, and emojis (`Shape`, `Note`, `Text`, `ImageItem`, `Gif`, `Emoji`)[cite: 1].
* **Multimedia & Video Sync:** Synchronized video playback across connected clients (`Video`, `VideoSocketManager`, `useVideoSync`)[cite: 1].
* **Real-Time Chat:** Built-in chat panel for live communication while collaborating (`Chat`)[cite: 1].
* **Object Manipulation:** Draggable and resizable elements on the board (`DraggableResizableWrapper`)[cite: 1].

---

## Project Structure

* `server.js` – Backend Node.js server handling real-time synchronization and WebSocket connections[cite: 1].
* `src/` – React frontend application containing components for the canvas, toolbar, sidebar, and chat[cite: 1].
* `public/` – Static assets, custom tool cursors, and icons[cite: 1].
* `ustawienie.env` – Environment configuration file[cite: 1].

---

## Installation & Getting Started

Follow these steps to set up your environment and run the project locally:

1. **Download the Node.js installer:**
   * Go to the official website [nodejs.org](https://nodejs.org/) and download the **LTS** version (e.g., `Download Node.js (LTS)`).
   * *Verification:* An `.msi` installer file will appear in your Downloads folder.

2. **Install Node.js with default settings:**
   * Run the downloaded `.msi` file and follow the installation wizard by clicking **Next** until you reach **Install** (make sure the *Add to PATH* option remains checked, as it is enabled by default).
   * *Verification:* Once the installation completes, a screen with the **Finish** button will appear.

3. **Restart your code editor / terminal:**
   * **Important:** Completely close the program where your terminal is open (e.g., Visual Studio Code or PowerShell) and open it again[cite: 2]. An already open terminal will not recognize the newly installed software.
   * *Verification:* Open a new terminal, type `node -v` and `npm -v`, and press Enter – version numbers (e.g., `v22.x.x`) should be displayed instead of an error message.

4. **Install dependencies and run the project:**
   * Navigate to the project folder in your terminal (e.g., `cd Whiteboard-main`) and install the required libraries:
     ```bash
     npm install
     ```
   * *(Optional)* Check the `ustawienie.env` file in the root directory (rename it to `.env` if required by your server configuration) and ensure all variables are properly set[cite: 1].
   * Start the **backend server** in your first terminal:
     ```bash
     node server.js
     ```
   * Open a **second terminal** in the same project directory and start the **frontend application**:
     ```bash
     npm start
     ```
   * *Verification:* Your browser will automatically open `http://localhost:3000` with the running Whiteboard application.

---

## Available Scripts

In the project directory, you can also run:

* `npm run build` – Builds the app for production to the `build` folder.
* `npm test` – Launches the test runner in interactive watch mode.
