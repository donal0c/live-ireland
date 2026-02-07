import type { EirgridDemandChannel } from "@/server/realtime/eirgrid-channel";

export type TrpcContext = {
  channel: EirgridDemandChannel;
};
