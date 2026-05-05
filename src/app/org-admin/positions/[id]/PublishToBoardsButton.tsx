"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Globe, Radio, Pause } from "lucide-react";
import {
  publishPositionAction,
  unpublishPositionAction,
} from "@/app/org-admin/distribution-actions";

export function PublishToBoardsButton({ positionId, initialIsPublished }: { positionId: string, initialIsPublished: boolean }) {
  const [isPublished, setIsPublished] = useState(initialIsPublished);
  const [isPending, startTransition] = useTransition();

  const handlePublish = () => {
    startTransition(async () => {
      try {
        await publishPositionAction(positionId);
        setIsPublished(true);
      } catch (err) {
        console.error("Publish failed:", err);
      }
    });
  };

  const handleUnpublish = () => {
    startTransition(async () => {
      try {
        await unpublishPositionAction(positionId);
        setIsPublished(false);
      } catch (err) {
        console.error("Unpublish failed:", err);
      }
    });
  };

  const onClick = isPublished ? handleUnpublish : handlePublish;

  return (
    <Button
      onClick={onClick}
      disabled={isPending}
      variant="outline"
      size="sm"
      className={`rounded-xl hover:-translate-y-0.5 transition-transform text-sm ${
        isPublished
          ? "text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100 hover:border-rose-300 dark:bg-rose-900/40 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-900/60"
          : "text-pink-700 bg-pink-50 border-pink-200 hover:bg-pink-100 hover:border-pink-300 dark:bg-pink-900/40 dark:border-pink-800 dark:text-pink-300 dark:hover:bg-pink-900/60"
      }`}
    >
      {isPending ? (
        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
      ) : isPublished ? (
        <Pause className="w-4 h-4 mr-1.5" />
      ) : (
        <Radio className="w-4 h-4 mr-1.5" />
      )}
      {isPending ? "Processing..." : isPublished ? "Unpublish from Job Boards" : "Publish to Job Boards"}
    </Button>
  );
}
