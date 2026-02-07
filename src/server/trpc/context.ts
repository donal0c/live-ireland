import type { AdapterManager } from "@/server/adapters/runtime/adapter-manager";
import type { EirgridDemandChannel } from "@/server/realtime/eirgrid-channel";

export type TrpcContext = {
  channel: EirgridDemandChannel;
  adapterManager: AdapterManager;
};
