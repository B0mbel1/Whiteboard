import React from 'react';
import { SketchPicker } from 'react-color';
import './ColorPicker.css';

const ColorPicker = ({ color, setColor, setShowColorPicker }) => {
  return (
    <div className="color-picker-panel">
      <SketchPicker color={color} onChangeComplete={(c) => setColor(c.hex)} />
    </div>
  );
};

export default ColorPicker;
