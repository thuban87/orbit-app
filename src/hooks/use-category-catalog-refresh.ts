import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useRef } from "react";
import { listCategories } from "@/db/contact-read";
import { getExecutor } from "@/db/database";
import { Logger } from "@/utils/logger";

export type CategoryCatalog = Array<{ id: number; name: string }>;
export type CategoryCatalogRequestSource = "initial" | "focus";

type CategoryCatalogRefreshCoordinator = {
  request: (source: CategoryCatalogRequestSource) => Promise<void>;
  invalidate: (reason: "blur" | "unmount") => void;
};

export function createCategoryCatalogRefreshCoordinator(input: {
  read: () => Promise<CategoryCatalog>;
  commit: (categories: CategoryCatalog) => void;
  reportFailure?: (source: CategoryCatalogRequestSource) => void;
}) {
  let generation = 0;

  return {
    async request(source: CategoryCatalogRequestSource): Promise<void> {
      const requestGeneration = ++generation;
      try {
        const categories = await input.read();
        if (requestGeneration === generation) input.commit(categories);
      } catch {
        input.reportFailure?.(source);
      }
    },
    invalidate(_reason: "blur" | "unmount"): void {
      generation += 1;
    },
  };
}

/** One lifecycle and generation boundary for every category publication. */
export function useCategoryCatalogRefresh(
  onCommit: (categories: CategoryCatalog) => void,
): () => Promise<void> {
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;
  const coordinatorRef = useRef<CategoryCatalogRefreshCoordinator | null>(null);
  if (coordinatorRef.current === null) {
    coordinatorRef.current = createCategoryCatalogRefreshCoordinator({
      read: () => listCategories(getExecutor()),
      commit: (categories) => commitRef.current(categories),
      reportFailure: (source) =>
        Logger.error(
          "category-catalog-refresh",
          `failed ${source} category refresh`,
        ),
    });
  }
  const coordinator = coordinatorRef.current;

  const requestInitial = useCallback(
    () => coordinator.request("initial"),
    [coordinator],
  );

  useFocusEffect(
    useCallback(() => {
      void coordinator.request("focus");
      return () => coordinator.invalidate("blur");
    }, [coordinator]),
  );

  useEffect(() => () => coordinator.invalidate("unmount"), [coordinator]);

  return requestInitial;
}
