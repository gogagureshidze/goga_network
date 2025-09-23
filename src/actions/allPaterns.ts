import RadialGradient from "@/patterns/RadialGradient";
import MatrixPattern from "../patterns/MatrixPattern";
import BluishFigures from "../patterns/BluishFigures"; // Corrected import path
import Shenenigan from "@/patterns/Shenenigan";
import Cyber from "@/patterns/Cyber";
import ShootingStars from "@/patterns/ShootingStars";
import Seeker from "@/patterns/Seeker";
import Rainbow from "@/patterns/Rainbow";
import Orbies from "@/patterns/Orbies";

// Define a type for your pattern objects.
export interface CustomPattern {
  id: string;
  name: string;
  component: React.ComponentType<any>;
  textColor: string;
}

// This array serves as your central registry of all available patterns.
const allPatterns: CustomPattern[] = [
  {
    id: "matrix",
    name: "Matrix Rain",
    component: MatrixPattern,
    textColor: "text-white",
  },
  {
    id: "radial",
    name: "Radial Gradient",
    component: RadialGradient,
    textColor: "text-white",
  },
  {
    id: "bluish",
    name: "Bluish Figures",
    component: BluishFigures,
    textColor: "text-white",
  },
  {
    id: "shenenigan",
    name: "Gradient Shenenigan",
    component: Shenenigan,
    textColor: "text-white",
  },
  {
    id: "cyber",
    name: "Cyber",
    component: Cyber,
    textColor: "text-white",
  },

  {
    id: "stars",
    name: "Shooting Stars",
    component: ShootingStars,
    textColor: "text-white",
  },

  {
    id: "seeker",
    name: "Seeker",
    component: Seeker,
    textColor: "text-white",
  },
  {
    id: "rainbow",
    name: "Rainbow default",
    component: Rainbow,
    textColor: "text-black",
  },
  {
    id: "orbies",
    name: "Space Orbies",
    component: Orbies,
    textColor: "text-white",
  },
];

export default allPatterns;
