import { upcItemDbConnector } from "./upcitemdb";
import { retailerDirectConnector } from "./retailer-direct";
import { localElectronicsConnector } from "./local-electronics";
import { authorizedOutletConnector } from "./authorized-outlet";
import { discountHomeConnector } from "./discount-home";
import { ebayConnector } from "./ebay";
import type { SourceConnector } from "./types";

const connectors: Record<string, SourceConnector> = {
  [upcItemDbConnector.sourceId]: upcItemDbConnector,
  [retailerDirectConnector.sourceId]: retailerDirectConnector,
  [localElectronicsConnector.sourceId]: localElectronicsConnector,
  [authorizedOutletConnector.sourceId]: authorizedOutletConnector,
  [discountHomeConnector.sourceId]: discountHomeConnector,
  [ebayConnector.sourceId]: ebayConnector,
};

export function getConnector(sourceId: string): SourceConnector {
  const connector = connectors[sourceId];
  if (!connector) throw new Error(`No connector registered for ${sourceId}`);
  return connector;
}

export function listConnectors() {
  return Object.keys(connectors);
}