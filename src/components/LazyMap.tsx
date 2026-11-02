import type { ComponentProps } from "react";
import DeliveryMap from "./DeliveryMap";

export type { MapStop } from "./DeliveryMap";

export function LazyMap(props: ComponentProps<typeof DeliveryMap>) {
  return <DeliveryMap {...props} />;
}
