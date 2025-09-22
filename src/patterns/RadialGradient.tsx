'use client'
import styled from "styled-components";

const RadialGradient = () => {
  return (
    <StyledWrapper>
      <div className="container" />
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  .container {
    width: 100%;
    height: 100vh;
    position: relative;
    background-color: #2b4c7e;
    border-radius: 0.5em;
    overflow: hidden;
    box-shadow: 0 0.3em 0.6em rgba(0, 0, 0, 0.2);
  }

  .container::before {
    content: "";
    position: absolute;
    inset: 0;
    background:
      linear-gradient(
          135deg,
          transparent 0%,
          transparent 47%,
          #567ebb 47%,
          #567ebb 53%,
          transparent 53%,
          transparent 100%
        )
        0 0/2em 2em,
      linear-gradient(
          45deg,
          #3a6098 0%,
          #3a6098 47%,
          transparent 47%,
          transparent 53%,
          #3a6098 53%,
          #3a6098 100%
        )
        0 0/2em 2em,
      linear-gradient(
          -45deg,
          #1d365a 0%,
          #1d365a 47%,
          transparent 47%,
          transparent 53%,
          #1d365a 53%,
          #1d365a 100%
        )
        0 0/2em 2em,
      linear-gradient(
          45deg,
          transparent 0%,
          transparent 47%,
          #4b72ab 47%,
          #4b72ab 53%,
          transparent 53%,
          transparent 100%
        )
        1em 1em/2em 2em;
    opacity: 0.5;
  }

  .container::after {
    content: "";
    position: absolute;
    inset: 0;
    background:
      radial-gradient(
          circle at 25% 25%,
          rgba(255, 255, 255, 0.15) 0.5em,
          transparent 0.5em
        )
        0 0/4em 4em,
      radial-gradient(
          circle at 75% 75%,
          rgba(255, 255, 255, 0.1) 0.3em,
          transparent 0.3em
        )
        0 0/4em 4em,
      radial-gradient(
          circle at 75% 25%,
          rgba(13, 35, 69, 0.1) 0.4em,
          transparent 0.4em
        )
        2em 0/4em 4em,
      radial-gradient(
          circle at 25% 75%,
          rgba(13, 35, 69, 0.15) 0.2em,
          transparent 0.2em
        )
        2em 2em/4em 4em;
  }

  @keyframes patternFloat {
    0% {
      background-position:
        0 0,
        0 0,
        0 0,
        1em 1em;
    }
    100% {
      background-position:
        2em 2em,
        2em 2em,
        2em 2em,
        3em 3em;
    }
  }

  .container::before {
    animation: patternFloat 20s linear infinite;
  }`;


export default RadialGradient;
