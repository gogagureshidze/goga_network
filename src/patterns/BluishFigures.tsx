"use client";
import styled from "styled-components";

const BluishFigures = () => {
  return (
    <StyledWrapper>
      <div className="container" />
    </StyledWrapper>
  );
};

const StyledWrapper = styled.div`
  width: 100%;
  height: 100vh; /* ✅ force full viewport height */

  .container {
    width: 100%;
    height: 100%;
    background-color: #102030;
    background-image: radial-gradient(
        circle at 15% 15%,
        rgba(255, 255, 255, 0.08) 2px,
        transparent 2px
      ),
      radial-gradient(
        circle at 85% 85%,
        rgba(255, 255, 255, 0.08) 2px,
        transparent 2px
      ),
      linear-gradient(135deg, #2a5298 25%, transparent 25%),
      linear-gradient(225deg, #2a5298 25%, transparent 25%),
      linear-gradient(315deg, #2a5298 25%, transparent 25%),
      linear-gradient(45deg, #2a5298 25%, transparent 25%);
    background-size: 50px 50px, 50px 50px, 100px 100px, 100px 100px, 100px 100px,
      100px 100px;
    background-position: 0 0, 0 0, 0 0, 0 0, 50px 50px, 50px 50px;
    animation: patternShift 60s infinite linear;
    position: relative;
    overflow: hidden;
  }

  .container::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: repeating-conic-gradient(
      from 0deg at 50% 50%,
      rgba(62, 155, 255, 0.1) 0deg 30deg,
      rgba(76, 175, 255, 0.05) 30deg 60deg,
      rgba(32, 125, 225, 0.1) 60deg 120deg,
      rgba(20, 96, 169, 0.05) 120deg 180deg,
      rgba(41, 134, 234, 0.1) 180deg 270deg,
      rgba(58, 151, 251, 0.05) 270deg 360deg
    );
    mask: radial-gradient(circle at center, transparent 30%, black 70%);
    opacity: 0.6;
    mix-blend-mode: overlay;
    pointer-events: none;
  }

  .container::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: linear-gradient(
        45deg,
        rgba(255, 255, 255, 0.03) 25%,
        transparent 25%,
        transparent 75%,
        rgba(255, 255, 255, 0.03) 75%
      ),
      linear-gradient(
        -45deg,
        rgba(255, 255, 255, 0.03) 25%,
        transparent 25%,
        transparent 75%,
        rgba(255, 255, 255, 0.03) 75%
      );
    background-size: 60px 60px;
    pointer-events: none;
  }

  @keyframes patternShift {
    0% {
      background-position: 0 0, 0 0, 0 0, 0 0, 50px 50px, 50px 50px;
    }
    100% {
      background-position: 100px 100px, -100px -100px, 100px 0px, 0px 100px,
        150px 150px, -50px 0px;
    }
  }
`;

export default BluishFigures;
