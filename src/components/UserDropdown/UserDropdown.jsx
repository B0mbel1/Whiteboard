import React, { useState } from "react";
import "./UserDropdown.css";

export default function UserDropdown({ users }) {
  const [open, setOpen] = useState(false);

  return (
    <div 
      className="user-dropdown-container"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {/* Pokazujemy liczbę użytkowników */}
      <span className="user-counter">
        👥 {users.length}
      </span>

      {/* Dropdown pojawia się po najechaniu */}
      {open && users.length > 0 && (
        <div className="user-dropdown-list">
          {users.map(user => (
            <div key={user.id} className="user-item">
              <span 
                className="user-color-dot"
                style={{ backgroundColor: user.color }}
              />
              {user.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
