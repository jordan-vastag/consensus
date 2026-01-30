"use client";

import { getSession, joinSession } from "@/app/api";
import { useSessionWebSocket } from "@/hooks/useSessionWebSocket";
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
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const SESSION_KEY = "consensus_session_data";

export default function SessionPage() {
  const router = useRouter();
  const params = useParams();
  const sessionCode = params.code?.toLowerCase();

  const [isLoading, setIsLoading] = useState(true);
  const [joinName, setJoinName] = useState("");
  const [needsToJoin, setNeedsToJoin] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
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
              <Button
                variant={
                  sessionState.ready[sessionState.myName] ? "outline" : "default"
                }
                onClick={() => setReady(!sessionState.ready[sessionState.myName])}
                disabled={!isConnected}
              >
                {sessionState.ready[sessionState.myName] ? "Not Ready" : "Ready"}
              </Button>
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
            <CardDescription>Voting Phase</CardDescription>
          </CardHeader>
          <CardContent>
            <p>All members are ready. Voting has begun!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
