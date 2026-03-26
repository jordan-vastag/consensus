"use client";

import { getResults } from "@/app/api";
import { Button } from "@/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/ui/card";
import { Spinner } from "@/ui/spinner";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function ResultsPage() {
  const router = useRouter();
  const params = useParams();
  const permalinkId = params.id;

  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!permalinkId) return;
    getResults(permalinkId)
      .then((response) => setResults(response))
      .catch(() => setError("Results not found"));
  }, [permalinkId]);

  if (error) {
    return (
      <div className="flex justify-center items-center h-200 flex-col">
        <div className="flex items-center">
          <img src="/circle-diagram.png" alt="Logo" width={150} height={150} />
          <h1 className="text-7xl font-bold">Consensus</h1>
        </div>
        <Card className="w-full max-w-sm m-10">
          <CardHeader>
            <CardTitle>Uh Oh!</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/")}>Go Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="flex justify-center items-center h-200 flex-col">
        <div className="flex items-center">
          <img src="/circle-diagram.png" alt="Logo" width={150} height={150} />
          <h1 className="text-7xl font-bold">Consensus</h1>
        </div>
        <Spinner className="size-8 mt-8" />
      </div>
    );
  }

  const isRankedChoice = results.votingMode === "ranked_choice";

  return (
    <div className="flex justify-center items-center h-200 flex-col">
      <div className="flex items-center">
        <img src="/circle-diagram.png" alt="Logo" width={150} height={150} />
        <h1 className="text-7xl font-bold">Consensus</h1>
      </div>
      <Card className="w-full max-w-sm m-10">
        <CardHeader>
          <CardTitle className="text-2xl">{results.title}</CardTitle>
          <CardDescription>Results</CardDescription>
          <CardAction>
            <div className="flex flex-col items-end gap-1">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    const text = `Consensus | ${results.title} results\n` +
                      results.rankedChoices
                      ?.map((c, i) => `${i + 1}. ${c.title}`)
                      .join("\n");
                    navigator.clipboard.writeText(text);
                    toast("Results copied to clipboard!");
                  }}
                >
                  <Image src="/copy.svg" alt="Copy" title="Copy Results" width={20} height={20} />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    const url = `${window.location.origin}/results/${permalinkId}`;
                    navigator.clipboard.writeText(url);
                    toast("Results link copied to clipboard!");
                  }}
                >
                  <Image src="/share.svg" alt="Share" title="Share Results" width={20} height={20} />
                </Button>
              </div>
              {results.createdAt && new Date(results.createdAt).getFullYear() > 1 && (
                <span className="text-xs text-muted-foreground">
                  {new Date(results.createdAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              )}
            </div>
          </CardAction>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2">
            {results.rankedChoices?.map((choice, index) => (
              <li
                key={`${choice.title}-${index}`}
                className="flex items-center justify-between py-2 px-4 rounded-md bg-muted"
              >
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground text-sm w-4">
                    {index + 1}.
                  </span>
                  <span>{choice.title}</span>
                </div>
                <div className="flex items-center gap-3">
                  {choice.memberName && (
                    <span className="text-xs text-muted-foreground">{choice.memberName}</span>
                  )}
                  <span className="text-sm font-medium text-green-700">
                    {choice.rank} {isRankedChoice ? "pts" : "yes"}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
