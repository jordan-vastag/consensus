"use client";

import {
  addChoice,
  clearChoices,
  getMemberChoices,
  getSession,
  joinSession,
  removeChoice,
} from "@/app/api";
import { useSessionWebSocket } from "@/hooks/useSessionWebSocket";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/ui/alert-dialog";
import { Button } from "@/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/ui/card";
import { Input } from "@/ui/input";
import { Spinner } from "@/ui/spinner";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const SESSION_KEY = "consensus_session_data";

export default function SessionPage() {
  const router = useRouter();
  const params = useParams();
  const sessionCode = params.code?.toLowerCase();

  const [isLoading, setIsLoading] = useState(true);
  const [joinName, setJoinName] = useState("");
  const [needsToJoin, setNeedsToJoin] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [choices, setChoices] = useState([]);
  const [newChoiceTitle, setNewChoiceTitle] = useState("");
  const [sessionState, setSessionState] = useState({
    active: false,
    code: "",
    members: [],
    host: "",
    myName: "",
    title: "",
    ready: {},
    phase: "lobby",
  });

  // WebSocket handlers
  const handleMemberJoined = useCallback((memberName) => {
    setSessionState((prev) => {
      if (prev.members.includes(memberName)) {
        return prev;
      }
      return {
        ...prev,
        members: [...prev.members, memberName],
        ready: { ...prev.ready, [memberName]: false },
      };
    });
  }, []);

  const handleMemberLeft = useCallback((memberName) => {
    setSessionState((prev) => {
      const newReady = { ...prev.ready };
      delete newReady[memberName];
      return {
        ...prev,
        members: prev.members.filter((m) => m !== memberName),
        ready: newReady,
      };
    });
  }, []);

  const handleMemberReady = useCallback((memberName, ready) => {
    setSessionState((prev) => ({
      ...prev,
      ready: { ...prev.ready, [memberName]: ready },
    }));
  }, []);

  const handlePhaseChanged = useCallback((phase, readyMap) => {
    setSessionState((prev) => ({
      ...prev,
      phase,
      ready: readyMap,
    }));
  }, []);

  const handleConnectedUsers = useCallback((connectedMembers) => {
    setSessionState((prev) => {
      // Filter members to only those currently connected
      const newReady = {};
      connectedMembers.forEach((m) => {
        newReady[m] = prev.ready[m] || false;
      });
      return {
        ...prev,
        members: connectedMembers,
        ready: newReady,
      };
    });
  }, []);

  const { isConnected, connect, setReady } = useSessionWebSocket(
    sessionState.code,
    sessionState.myName,
    {
      onMemberJoined: handleMemberJoined,
      onMemberLeft: handleMemberLeft,
      onMemberReady: handleMemberReady,
      onPhaseChanged: handlePhaseChanged,
      onConnectedUsers: handleConnectedUsers,
    }
  );

  // Connect WebSocket when session becomes active
  useEffect(() => {
    if (sessionState.active && sessionState.code && sessionState.myName) {
      connect();
    }
  }, [sessionState.active, sessionState.code, sessionState.myName, connect]);

  // Load choices when entering voting phase
  useEffect(() => {
    if (sessionState.phase === "voting" && sessionState.code && sessionState.myName) {
      getMemberChoices(sessionState.code, sessionState.myName)
        .then((response) => {
          setChoices(response.choices || []);
        })
        .catch((e) => {
          console.error("Failed to load choices:", e);
          toast.error("Failed to load your choices");
        });
    }
  }, [sessionState.phase, sessionState.code, sessionState.myName]);

  const handleAddChoice = async () => {
    if (!newChoiceTitle.trim()) return;

    try {
      await addChoice(sessionState.code, sessionState.myName, newChoiceTitle.trim());
      setChoices((prev) => [...prev, { title: newChoiceTitle.trim() }]);
      setNewChoiceTitle("");
    } catch (e) {
      console.error("Failed to add choice:", e);
      toast.error("Failed to add choice");
    }
  };

  const handleRemoveChoice = async (title) => {
    try {
      await removeChoice(sessionState.code, sessionState.myName, title);
      setChoices((prev) => prev.filter((c) => c.title !== title));
    } catch (e) {
      console.error("Failed to remove choice:", e);
      toast.error("Failed to remove choice");
    }
  };

  const handleClearChoices = async () => {
    try {
      await clearChoices(sessionState.code, sessionState.myName);
      setChoices([]);
      toast.success("All choices cleared");
    } catch (e) {
      console.error("Failed to clear choices:", e);
      toast.error("Failed to clear choices");
    }
  };

  // Check session and attempt to rejoin on load
  useEffect(() => {
    if (!sessionCode) return;

    const savedSession = JSON.parse(localStorage.getItem(SESSION_KEY));

    // If we have saved session data for this session, try to rejoin
    if (savedSession?.code === sessionCode && savedSession?.name) {
      getSession(sessionCode)
        .then((response) => {
          const closedAt = new Date(response.Session.closed_at);
          if (closedAt.getFullYear() > 1) {
            throw new Error("Session is closed");
          }

          const members = response.Session.members.map((m) => m.name);
          if (!members.includes(savedSession.name)) {
            // User was removed from session, need to rejoin
            setNeedsToJoin(true);
            setIsLoading(false);
            return;
          }

          const host = response.Session.members.find((m) => m.host).name;
          const ready = {};
          members.forEach((m) => (ready[m] = false));

          setSessionState({
            active: true,
            code: sessionCode,
            members,
            host,
            myName: savedSession.name,
            title: response.Session.title,
            ready,
            phase: "lobby",
          });
          setIsLoading(false);
        })
        .catch((e) => {
          console.error("Failed to rejoin session:", e);
          localStorage.removeItem(SESSION_KEY);
          setErrorMessage("Session not found or closed");
          setIsLoading(false);
        });
    } else {
      // No saved session or different session, check if session exists
      getSession(sessionCode)
        .then((response) => {
          const closedAt = new Date(response.Session.closed_at);
          if (closedAt.getFullYear() > 1) {
            throw new Error("Session is closed");
          }
          setNeedsToJoin(true);
          setIsLoading(false);
        })
        .catch(() => {
          setErrorMessage("Session not found or closed");
          setIsLoading(false);
        });
    }
  }, [sessionCode]);

  const handleJoinSessionClick = () => {
    setIsLoading(true);
    joinSession(sessionCode, joinName)
      .then((response) => {
        const members = response.Session.members.map((m) => m.name);
        const host = response.Session.members.find((m) => m.host).name;
        const ready = {};
        members.forEach((m) => (ready[m] = false));

        localStorage.setItem(
          SESSION_KEY,
          JSON.stringify({ name: joinName, code: sessionCode })
        );

        setSessionState({
          active: true,
          code: sessionCode,
          members,
          host,
          myName: joinName,
          title: response.Session.title,
          ready,
          phase: "lobby",
        });
        setNeedsToJoin(false);
        setIsLoading(false);
      })
      .catch(() => {
        setErrorMessage("Failed to join session. Name may already be taken.");
        setIsLoading(false);
      });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-200 flex-col">
        <h1 className="self-center text-7xl font-bold">Consensus</h1>
        <Spinner className="size-8 mt-8" />
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="flex justify-center items-center h-200 flex-col">
        <h1 className="self-center text-7xl font-bold">Consensus</h1>
        <Card className="w-full max-w-sm m-10">
          <CardHeader>
            <CardTitle>Uh Oh!</CardTitle>
            <CardDescription>{errorMessage}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/")}>Go Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (needsToJoin) {
    return (
      <div className="flex justify-center items-center h-200 flex-col">
        <h1 className="self-center text-7xl font-bold">Consensus</h1>
        <Card className="w-full max-w-sm m-10">
          <CardHeader>
            <CardTitle>Join Session</CardTitle>
            <CardDescription>
              Session code: {sessionCode.toUpperCase()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <Input
                placeholder="Your name"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
              />
              <div className="flex items-center justify-evenly">
                <Button variant="outline" onClick={() => router.push("/")}>
                  Cancel
                </Button>
                <Button onClick={handleJoinSessionClick} disabled={!joinName}>
                  Join
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center h-200 flex-col">
      <h1 className="self-center text-7xl font-bold">Consensus</h1>

      {sessionState.active && sessionState.phase === "lobby" && (
        <Card className="w-full max-w-sm m-10">
          <CardHeader>
            <CardTitle className="text-2xl">{sessionState.title}</CardTitle>
            <CardDescription className="text-lg">
              Join Code: {sessionState.code.toUpperCase()}
            </CardDescription>
            <CardAction>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    const url = `${window.location.origin}/s/${sessionState.code}`;
                    navigator.clipboard.writeText(url);
                    toast("Link copied to clipboard!", {
                      description: "Share it with a friend to invite them.",
                    });
                  }}
                >
                  <Image src="/share.png" alt="Share" width={20} height={20} />
                </Button>
                <Button
                  variant={
                    sessionState.ready[sessionState.myName] ? "outline" : "default"
                  }
                  onClick={() => setReady(!sessionState.ready[sessionState.myName])}
                  disabled={!isConnected}
                >
                  {sessionState.ready[sessionState.myName] ? "Not Ready" : "Ready"}
                </Button>
              </div>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="text-md underline mb-2">Members</div>
            <ul className="space-y-1">
              {sessionState?.members.map((member) => (
                <li key={member} className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      sessionState.ready[member] ? "bg-green-500" : "bg-gray-300"
                    }`}
                  />
                  <span>
                    {member}
                    {member === sessionState.host && " (host)"}
                    {member === sessionState.myName && " (you)"}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {sessionState.active && sessionState.phase === "voting" && (
        <Card className="w-full max-w-sm m-10">
          <CardHeader>
            <CardTitle className="text-2xl">{sessionState.title}</CardTitle>
            <CardDescription>Create a List</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4">Add your suggestions for <b>{sessionState.title}</b></p>

            {/* Add choice input */}
            <div className="flex gap-2 mb-4">
              <Input
                placeholder="Add an option..."
                value={newChoiceTitle}
                onChange={(e) => setNewChoiceTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddChoice();
                  }
                }}
              />
              <Button onClick={handleAddChoice} disabled={!newChoiceTitle.trim()}>
                Add
              </Button>
            </div>

            {/* Choices list */}
            {choices.length > 0 && (
              <ul className="space-y-2 mb-4">
                {choices.map((choice) => (
                  <li
                    key={choice.title}
                    className="flex items-center justify-between py-2 px-4 rounded-md bg-muted group"
                  >
                    <span>{choice.title}</span>
                    <button
                      onClick={() => handleRemoveChoice(choice.title)}
                      className="cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1"
                      aria-label={`Remove ${choice.title}`}
                    >
                      <Image src="/trash.png" alt="Remove" width={20} height={20} className="opacity-70 hover:opacity-100 transition-opacity" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {choices.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-4">
                No options added yet. Add your first option above!
              </p>
            )}

            {/* Action buttons */}
            {choices.length > 0 && (
              <div className="flex justify-between items-center">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="lg"
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 w-28"
                    >
                      Clear
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear all choices?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove all your options. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        onClick={handleClearChoices}
                      >
                        Clear All
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="lg" className="w-40">
                      Submit
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Submit your choices?</AlertDialogTitle>
                      <AlertDialogDescription>
                        You won&apos;t be able to make changes after submitting.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => setSessionState((prev) => ({ ...prev, phase: "submitted" }))}
                      >
                        Submit
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {sessionState.active && sessionState.phase === "submitted" && (
        <Card className="w-full max-w-sm m-10">
          <CardHeader>
            <CardTitle className="text-2xl">{sessionState.title}</CardTitle>
            <CardDescription>Vote!</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Time to vote</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
