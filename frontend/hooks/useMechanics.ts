"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/apiClient";
import { mechanicsService } from "@/services/mechanics";

export function useMechanics() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["mechanics"],
    queryFn: mechanicsService.read,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
  const mutation = useMutation({
    mutationFn: mechanicsService.act,
    onMutate: async () => {
      await client.cancelQueries({ queryKey: ["mechanics"] });
    },
    onSuccess: (data) => {
      client.setQueryData(["mechanics"], data);
      client.invalidateQueries({ queryKey: ["characters"] });
      client.invalidateQueries({ queryKey: ["notes"] });
      client.invalidateQueries({ queryKey: ["analytics"] });
      toast.success("Changes saved.");
    },
    onError: (error: Error) => {
      toast.error(error.message);
      if (error instanceof ApiError && error.status === 409) {
        client.invalidateQueries({ queryKey: ["mechanics"] });
      }
    },
    onSettled: () => client.invalidateQueries({ queryKey: ["mechanics"] }),
  });
  return { ...query, mutation };
}
