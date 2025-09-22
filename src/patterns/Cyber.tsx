'use client'
import styled from "styled-components";

const Cyber = () => {
  return (
    <StyledWrapper>
      <div className="container" />
    </StyledWrapper>
  );
};

const StyledWrapper = styled.div`
  .container {
    width: 100%;
    height: 100vh;
    --color: rgba(0, 115, 19, 0.3);
    background-color: #191a1a;
    background-image: linear-gradient(
        180deg,
        transparent 24%,
        var(--color) 25%,
        var(--color) 26%,
        transparent 27%,
        transparent 74%,
        var(--color) 75%,
        var(--color) 76%,
        transparent 77%,
        transparent
      ),
      linear-gradient(
        45deg,
        transparent 24%,
        var(--color) 35%,
        var(--color) 26%,
        transparent 17%,
        transparent 74%,
        var(--color) 75%,
        var(--color) 76%,
        transparent 77%,
        transparent
      );
    background-size: 55px 55px;
  }
`;

export default Cyber;
