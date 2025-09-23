"use client";
import React, { useState } from "react";
import styled, { css } from "styled-components";

const Orbies = () => {
  const [hoveredOrb, setHoveredOrb] = useState<string | null>(null);

  const handleMouseEnter = (orbName: string) => {
    setHoveredOrb(orbName);
  };

  const handleMouseLeave = () => {
    setHoveredOrb(null);
  };

  return (
    <StyledWrapper hoveredOrb={hoveredOrb}>
      <div
        className="particle"
        onMouseEnter={() => handleMouseEnter("particle")}
        onMouseLeave={handleMouseLeave}
      />
      <div
        className="cells"
        onMouseEnter={() => handleMouseEnter("cells")}
        onMouseLeave={handleMouseLeave}
      />
      <div
        className="jelly"
        onMouseEnter={() => handleMouseEnter("jelly")}
        onMouseLeave={handleMouseLeave}
      />
      <div
        className="blobbs"
        onMouseEnter={() => handleMouseEnter("blobbs")}
        onMouseLeave={handleMouseLeave}
      />
      <div
        className="chase"
        onMouseEnter={() => handleMouseEnter("chase")}
        onMouseLeave={handleMouseLeave}
      />
    </StyledWrapper>
  );
};

const StyledWrapper = styled.div<{ hoveredOrb: string | null }>`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 20px;
  padding: 40px;
  background-color: hsl(0, 0%, 18%);
  min-height: 100vh;
  transition: all 0.3s ease;

  div {
    position: relative;
    width: 200px;
    height: 200px;
    border-radius: 50%;
    border: 10px solid hsla(0, 0%, 0%, 0.7);
    box-shadow: inset 0 15px 15px -5px hsla(0, 0%, 100%, 0.7),
      inset 0 -5px 10px 3px hsla(0, 0%, 0%, 0.6),
      0 8px 10px 2px hsla(0, 0%, 0%, 0.3);
    background-position: center;
    transform: scale(1);
    transition: transform 0.3s cubic-bezier(0.32, 0, 0.15, 1);
  }

  div::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: rgba(0, 0, 0, 0);
    pointer-events: auto;
  }

  div::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: inherit;
    background-clip: content-box;
    padding: 20%;
    box-shadow: inherit;
    border: inherit;
    transform: scale(0.66);
    transition: transform 0.3s cubic-bezier(0.32, 0, 0.15, 1);
  }

  /* === Universal Orb Styles === */
  div:hover {
    cursor: pointer;
    transform: scale(1.1);
  }
  div:hover::before {
    transform: scale(1);
  }

  /* === Particle === */
  .particle {
    background: radial-gradient(circle at center, #000 0%, #333 50%, #000 100%);
  }
  .particle::before {
    background-size: 12px 12px;
    background-color: #000;
    box-shadow: inset 0 15px 15px -5px hsla(0, 0%, 100%, 0.25),
      inset 0 -5px 10px 3px hsla(0, 0%, 0%, 0.6),
      0 8px 10px 2px hsla(0, 0%, 0%, 0.3);
    background-image: radial-gradient(
        #555 0px,
        hsla(0, 0%, 0%, 0) 2px,
        hsla(0, 0%, 0%, 0) 24px
      ),
      repeating-radial-gradient(white 0px, black 2px, black 48px);
  }
  ${({ hoveredOrb }) =>
    hoveredOrb === "particle" &&
    css`
      .particle::before {
        animation: particle-size 0.24s linear infinite,
          particle-position 0.48s linear infinite alternate;
      }
    `}

  /* === Cells === */
  .cells {
    background: radial-gradient(circle at center, #fff 0%, #eee 50%, #fff 100%);
  }
  .cells::before {
    background-size: 24px 24px;
    background-color: #fff;
    background-image: repeating-radial-gradient(black 8px, white 12px);
  }
  ${({ hoveredOrb }) =>
    hoveredOrb === "cells" &&
    css`
      .cells::before {
        animation: cells 0.4s linear infinite;
      }
    `}

  /* === Jelly === */
  .jelly {
    background: radial-gradient(
      circle at center,
      hsl(320, 80%, 60%) 0%,
      hsl(320, 80%, 40%) 100%
    );
  }
  .jelly::before {
    background-size: 60px 60px;
    background-color: hsla(320, 80%, 60%, 1);
    background-image: repeating-radial-gradient(
        hsla(320, 100%, 60%, 0.6) 0px,
        hsla(220, 100%, 60%, 0) 60%
      ),
      repeating-radial-gradient(
        hsla(330, 100%, 40%, 1) 12%,
        hsla(320, 80%, 60%, 1) 24px
      );
  }
  ${({ hoveredOrb }) =>
    hoveredOrb === "jelly" &&
    css`
      .jelly::before {
        animation: jelly 1.4s cubic-bezier(0.1, 0.4, 0.9, 0.6) infinite;
      }
    `}

  /* === Blobbs === */
  .blobbs {
    background: radial-gradient(
      circle at center,
      hsl(200, 100%, 50%) 0%,
      hsl(200, 100%, 30%) 100%
    );
  }
  .blobbs::before {
    background-size: 66px 66px;
    background-color: hsl(200, 100%, 50%);
    background-image: repeating-radial-gradient(
        hsla(200, 100%, 80%, 0.8) 0px,
        hsla(200, 100%, 80%, 0.5) 4px,
        hsla(200, 100%, 80%, 0) 50px
      ),
      repeating-radial-gradient(
        hsla(260, 100%, 0%, 0) 0px,
        hsla(260, 100%, 50%, 0.1) 2px,
        hsla(260, 100%, 0%, 0) 10px
      );
  }
  ${({ hoveredOrb }) =>
    hoveredOrb === "blobbs" &&
    css`
      .blobbs::before {
        animation: blobbs-position 6s cubic-bezier(0.4, 0, 0.2, 1) infinite,
          blobbs-size 0.75s cubic-bezier(0.4, 0, 0.2, 1) infinite alternate;
      }
    `}

  /* === Chase === */
  .chase {
    background: radial-gradient(
      circle at center,
      hsl(50, 100%, 70%) 0%,
      hsl(50, 100%, 50%) 100%
    );
  }
  .chase::before {
    background-repeat: no-repeat, repeat;
    background-size: 180px 180px;
    background-color: hsl(50, 100%, 70%);
    background-image: repeating-radial-gradient(
        hsla(50, 100%, 100%, 1) 0px,
        hsla(50, 100%, 90%, 1) 10px,
        hsla(50, 100%, 70%, 0.2) 12px,
        hsla(50, 100%, 70%, 0) 130px
      ),
      repeating-radial-gradient(
        hsla(20, 100%, 50%, 0) 20%,
        hsla(20, 100%, 50%, 0.4) 80%,
        hsla(50, 100%, 70%, 1) 120px
      );
  }
  ${({ hoveredOrb }) =>
    hoveredOrb === "chase" &&
    css`
      .chase::before {
        animation: chase-position 1.2s infinite,
          chase-size 0.4s infinite alternate;
      }
    `}

  /* === Keyframes === */
  @keyframes particle-size {
    from {
      background-size: 6px 6px, 12px 12px;
    }
    to {
      background-size: 12px 12px, 24px 24px;
    }
  }
  @keyframes particle-position {
    from {
      background-position: 60px, 60px;
    }
    to {
      background-position: 140px, 140px;
    }
  }
  @keyframes cells {
    from {
      background-size: 12px 12px;
    }
    to {
      background-size: 24px 24px;
    }
  }
  @keyframes jelly {
    from {
      background-size: 60px 60px, 24px 24px;
    }
    50% {
      background-size: 120px 120px, 100px 100px;
    }
    to {
      background-size: 24px 24px, 140px 140px;
    }
  }
  @keyframes blobbs-position {
    0% {
      background-position: left top, left top;
    }
    25% {
      background-position: right top, left bottom;
    }
    50% {
      background-position: right bottom, right bottom;
    }
    75% {
      background-position: left bottom, right top;
    }
    100% {
      background-position: left top, left top;
    }
  }
  @keyframes blobbs-size {
    from {
      background-size: 200px 200px, 200px 200px;
    }
    to {
      background-size: 66px 66px, 66px 66px;
    }
  }
  @keyframes chase-position {
    0% {
      background-position: left top, left top;
    }
    25% {
      background-position: right top, left bottom;
    }
    50% {
      background-position: right bottom, right bottom;
    }
    75% {
      background-position: left bottom, right top;
    }
    100% {
      background-position: left top, left top;
    }
  }
  @keyframes chase-size {
    from {
      background-size: 120px 120px, 300px 300px;
    }
    50% {
      background-size: 160px 160px, 150px 150px;
    }
    to {
      background-size: 180px 180px, 100px 100px;
    }
  }
`;

export default Orbies;
