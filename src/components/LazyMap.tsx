import { lazy, Suspense, type ComponentProps } from "react";
import { ClientOnly } from "@tanstack/react-router";

const DeliveryMap = lazy(() => import("./DeliveryMap"));

export type { MapStop } from "./DeliveryMap";

export function LazyMap(props: ComponentProps<typeof DeliveryMap>) {
  const fallback = <div className="h-full w-full animate-pulse bg-muted" />;
  return (
    <ClientOnly fallback={fallback}>
      <Suspense fallback={fallback}>
        <DeliveryMap {...props} />
      </Suspense>
    </ClientOnly>
  );
}
