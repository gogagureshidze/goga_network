"use client";
import React from "react";

const Rainbow = () => {
  const animationTime = 45;
  const length = 25;

  const colors = [
    ["rgb(232, 121, 249)", "rgb(96, 165, 250)", "rgb(94, 234, 212)"],
    ["rgb(232, 121, 249)", "rgb(94, 234, 212)", "rgb(96, 165, 250)"],
    ["rgb(94, 234, 212)", "rgb(232, 121, 249)", "rgb(96, 165, 250)"],
    ["rgb(94, 234, 212)", "rgb(96, 165, 250)", "rgb(232, 121, 249)"],
    ["rgb(96, 165, 250)", "rgb(94, 234, 212)", "rgb(232, 121, 249)"],
    ["rgb(96, 165, 250)", "rgb(232, 121, 249)", "rgb(94, 234, 212)"],
  ];

  const getRandomColors = () => {
    return colors[Math.floor(Math.random() * colors.length)];
  };

  return (
    <>
      <style jsx>{`
        .rainbow {
          height: 100vh;
          width: 0;
          top: 0;
          position: absolute;
          transform: rotate(10deg);
          transform-origin: top right;
          animation: ${animationTime}s linear infinite slide;
        }

        @keyframes slide {
          from {
            right: -25vw;
          }
          to {
            right: 125vw;
          }
        }

        .h {
          box-shadow: 0 0 50vh 40vh white;
          width: 100vw;
          height: 0;
          bottom: 0;
          left: 0;
          position: absolute;
        }
        .v {
          box-shadow: 0 0 35vw 25vw white;
          width: 0;
          height: 100vh;
          bottom: 0;
          left: 0;
          position: absolute;
        }
      `}</style>
      <div className="w-full h-full relative overflow-hidden">
        {Array.from({ length: length }).map((_, i) => {
          const randomColors = getRandomColors();
          const animationDelay = `-${(i / length) * animationTime}s`;
          const animationDuration = `${
            animationTime - (animationTime / length / 2) * i
          }s`;

          // Updated box-shadow for a more spread-out effect
          const boxShadow = `-180px 0 150px 80px white, -80px 0 120px 60px ${randomColors[0]}, 0 0 100px 50px ${randomColors[1]}, 80px 0 120px 60px ${randomColors[2]}, 180px 0 150px 80px white`;

          return (
            <div
              key={i}
              className="rainbow"
              style={{
                boxShadow: boxShadow,
                animationDelay: animationDelay,
                animationDuration: animationDuration,
              }}
            />
          );
        })}
        <div className="h" />
        <div className="v" />
      </div>
    </>
  );
};

export default Rainbow;
