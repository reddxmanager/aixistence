/**
 * BackButton — subtle escape hatch in the top-left corner.
 * 
 * Visible during conversation and on the mirror reveal screen.
 * Fades in gently, stays out of the way. Navigates back to landing page.
 */

import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { stopHeartbeat } from "./audioEngine";

interface BackButtonProps {
  /** Optional label override */
  label?: string;
}

export default function BackButton({ label }: BackButtonProps) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={() => {
        stopHeartbeat();
        navigate("/");
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label="Return to scenario select"
      style={{
        position: "fixed",
        top: "20px",
        left: "20px",
        zIndex: 200,
        background: "transparent",
        border: "none",
        color: hovered ? "#8888aa" : "#555568",
        fontSize: "13px",
        fontFamily: "'Georgia', serif",
        cursor: "pointer",
        letterSpacing: "0.08em",
        padding: "8px 12px",
        transition: "color 0.3s ease",
        opacity: 0.8,
      }}
    >
      {label || "← back"}
    </button>
  );
}
