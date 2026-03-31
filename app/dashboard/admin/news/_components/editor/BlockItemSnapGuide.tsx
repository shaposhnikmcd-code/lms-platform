"use client";

import React from "react";

const ff = "-apple-system, BlinkMacSystemFont, sans-serif";

interface Props {
  snapGuideH: number;
}

export default function BlockItemSnapGuide({ snapGuideH }: Props) {
  return (
    <div style={{
      position: "absolute",
      left: "-12px",
      right: "-12px",
      top: `${snapGuideH - 1}px`,
      height: "2px",
      background: "#D4A843",
      zIndex: 20,
      pointerEvents: "none",
      boxShadow: "0 0 6px rgba(212,168,67,0.6)",
    }}>
      <div style={{
        position: "absolute",
        left: "0",
        top: "50%",
        transform: "translateY(-50%)",
        background: "#D4A843",
        color: "#1C3A2E",
        fontSize: "10px",
        fontWeight: 800,
        padding: "2px 6px",
        borderRadius: "4px",
        fontFamily: ff,
        whiteSpace: "nowrap",
      }}>
        {`= ${Math.round(snapGuideH)}px`}
      </div>
    </div>
  );
}