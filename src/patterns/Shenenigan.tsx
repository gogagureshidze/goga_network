"use client";
import styled from "styled-components";

const Shenenigan = () => {
  return (
    <StyledWrapper>
      <div className="container" />
    </StyledWrapper>
  );
};

const StyledWrapper = styled.div`
  .container {
    position: relative;
    width: 100%;
    height: 100vh;
    --c: #8d0000ff;
    background-color: #000;
    background-image: radial-gradient(
        4px 100px at 0px 235px,
        var(--c),
        transparent
      ),
      radial-gradient(4px 100px at 150px 235px, var(--c), transparent),
      radial-gradient(2px 2px at 75px 117.5px, var(--c) 100%, transparent 150%),
      radial-gradient(4px 100px at 0px 252px, var(--c), transparent),
      radial-gradient(4px 100px at 150px 252px, var(--c), transparent),
      radial-gradient(2px 2px at 75px 126px, var(--c) 100%, transparent 150%),
      radial-gradient(4px 100px at 0px 150px, var(--c), transparent),
      radial-gradient(4px 100px at 150px 150px, var(--c), transparent),
      radial-gradient(2px 2px at 75px 75px, var(--c) 100%, transparent 150%);
    background-size: 150px 235px, 150px 235px, 150px 235px, 150px 252px,
      150px 252px, 150px 252px, 150px 150px, 150px 150px, 150px 150px;
    animation: rainFall 20s linear infinite;
  }

  @keyframes rainFall {
    0% {
      background-position: 0px 220px, 75px 220px, 37.5px 337.5px, 25px 24px,
        100px 24px, 62.5px 150px, 50px 16px, 125px 16px, 87.5px 91px;
    }
    100% {
      background-position: 0px 1420px, 75px 1420px, 37.5px 1537.5px, 25px 1224px,
        100px 1224px, 62.5px 1350px, 50px 1216px, 125px 1216px, 87.5px 1291px;
    }
  }
`;

export default Shenenigan;
