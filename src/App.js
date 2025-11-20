import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Whiteboard from './components/Whiteboard/Whiteboard';
import WhiteboardRouter from './components/Whiteboard/WhiteboardRouter';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Main route auto-creates whiteboard and redirects */}
          <Route path="/" element={<Whiteboard />} />
          {/* Specific whiteboard route */}
          <Route path="/:whiteboardId" element={<WhiteboardRouter />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;