import type { Metadata } from "next";
import XRExperienceClient from "@/components/xr/XRExperienceClient";

export const metadata: Metadata = {
  title: "Orbital Skill Habitat XR Demo",
  description:
    "WebXR demo shell for ISS-style maintenance scenes with desktop fallback and secure Tripo asset loading.",
};

export default function XRPage() {
  return <XRExperienceClient />;
}
