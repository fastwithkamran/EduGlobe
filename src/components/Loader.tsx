"use client";

import { Lottie } from "lottie-react";
import animationData from "../../public/animations/loading.json";

export default function LottieAnimation() {
  return (
    <div style={{ width: 300, height: 300 }}>
      <Lottie src={animationData} autoplay loop />
    </div>
  );
}
