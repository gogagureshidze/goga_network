import BluishFigures from "../patterns/BluishFigures";
import Shenenigan from "@/patterns/Shenenigan";
import Cyber from "@/patterns/Cyber";
import ShootingStars from "@/patterns/ShootingStars";
import Seeker from "@/patterns/Seeker";
import FaultyTerminal from "../patterns/FaultyTerminalPattern";
import AuroraPattern from "../patterns/Aurora";
import ThreadsPattern from "@/patterns/Threads";
import Matrix from "@/patterns/Matrix";

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
    id: "aurora",
    name: "Aurora",
    component: AuroraPattern,
    textColor: "text-white",
  },

  {
    id: "threads",
    name: "Threads",
    component: ThreadsPattern,
    textColor: "text-white",
  },
  {
    id: "bluish",
    name: "BluishFigures",
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
    id: "matrix",
    name: "Sakura Matrix",
    component: Matrix,
    textColor: "text-white",
  },
  {
    id: "seeker",
    name: "Seeker",
    component: Seeker,
    textColor: "text-white",
  },
  {
    id: "faulty",
    name: "Faulty Terminal",
    component: FaultyTerminal,
    textColor: "text-white",
  },
];

export default allPatterns;
