import { apiClient } from "@/lib/apiClient";
import type { MechanicsCommand, MechanicsSnapshot } from "@/types/mechanics";

export const mechanicsService = {
  read: () => apiClient.get<MechanicsSnapshot>("/api/mechanics"),
  act: (command: MechanicsCommand) =>
    apiClient.post<MechanicsSnapshot>("/api/mechanics", command),
};
