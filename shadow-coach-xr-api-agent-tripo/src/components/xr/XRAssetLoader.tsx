"use client";

import { Clone, Html, useGLTF } from "@react-three/drei";
import { Component, type ReactNode, Suspense } from "react";
import type { ThreeElements } from "@react-three/fiber";
import type { GLTF } from "three-stdlib";

type GroupElementProps = ThreeElements["group"];

type XRAssetLoaderProps = GroupElementProps & {
  url: string;
  name: string;
  fallback: ReactNode;
  onError?: (message: string) => void;
};

type AssetBoundaryProps = {
  fallback: ReactNode;
  onError?: (message: string) => void;
  children: ReactNode;
};

type AssetBoundaryState = {
  hasError: boolean;
};

class AssetBoundary extends Component<AssetBoundaryProps, AssetBoundaryState> {
  public state: AssetBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return {
      hasError: true,
    };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error.message);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

function AssetModel({ url, ...props }: GroupElementProps & { url: string }) {
  const gltf = useGLTF(url) as GLTF;

  return (
    <group {...props}>
      <Clone object={gltf.scene} />
    </group>
  );
}

function AssetLoadingFallback({ name, fallback }: { name: string; fallback: ReactNode }) {
  return (
    <>
      {fallback}
      <Html center>
        <div className="rounded-full border border-white/12 bg-slate-950/85 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-200">
          Loading {name}
        </div>
      </Html>
    </>
  );
}

export default function XRAssetLoader({
  url,
  name,
  fallback,
  onError,
  ...props
}: XRAssetLoaderProps) {
  return (
    <AssetBoundary fallback={fallback} onError={onError}>
      <Suspense fallback={<AssetLoadingFallback name={name} fallback={fallback} />}>
        <AssetModel url={url} {...props} />
      </Suspense>
    </AssetBoundary>
  );
}
