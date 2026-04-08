"use client";

import { Button } from "@/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/ui/dialog";
import { Input } from "@/ui/input";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";

export function ShareDialog({ open, onOpenChange, url, title = "Share", description = "" }) {
  const [showCheckmark, setShowCheckmark] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="flex items-center gap-2">
          <Input readOnly value={url} onFocus={(e) => e.target.select()} />
          <Button
            variant="outline"
            size="icon"
            className={showCheckmark ? "bg-green-200 hover:bg-green-100" : ""}
            onClick={() => {
              if (!showCheckmark) {
                navigator.clipboard.writeText(url);
                toast("Link copied to clipboard!");
                setShowCheckmark(true);
                setTimeout(() => {
                  setShowCheckmark(false);
                }, 3000);
              }
            }}
            aria-label="Copy link"
          >
            {!showCheckmark && (
              <Image src="/copy.svg" alt="Copy" width={16} height={16} />
            )}
            {showCheckmark && (
              <Image src="/check.svg" alt="Copied" width={16} height={16} />
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
