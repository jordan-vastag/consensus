"use client";

import { hostSession, joinSession } from "@/app/api";
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
import { Checkbox } from "@/ui/checkbox";
import { Input } from "@/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/ui/input-otp";
import { Label } from "@/ui/label";
import { RadioGroup, RadioGroupItem } from "@/ui/radio-group";
import { Spinner } from "@/ui/spinner";
import { REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "consensus_user_name";

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [isRejoining, setIsRejoining] = useState(null);
  const [hostClicked, setHostClicked] = useState(false);
  const [joinClicked, setJoinClicked] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState("");
  const [errorMessage, setErrorMessage] = useState({
    visible: false,
    text: "Something went wrong. Please reload the page and try again later if the problem persists.",
  });
  const [sessionConfig, setSessionConfig] = useState({
    name: "",
    title: "",
    anonymity: false,
    voting_mode: "yes_no",
    min_choices: 1,
    max_choices: 3,
    grace_period_seconds: 3,
    allow_empty_voters: false,
  });
  const [sessionState, setSessionState] = useState({
    active: false,
    code: "",
    members: [],
    host: "",
    myName: "",
    ready: {}, // memberName → ready status
    phase: "lobby",
  });

  // WebSocket handlers
  const handleMemberJoined = useCallback((memberName) => {
    setSessionState((prev) => ({
      ...prev,
      members: [...prev.members, memberName],
      ready: { ...prev.ready, [memberName]: false },
    }));
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

  const { isConnected, webSocketError, connect, setReady } = useSessionWebSocket(
    sessionState.code,
    sessionState.myName,
    {
      onMemberJoined: handleMemberJoined,
      onMemberLeft: handleMemberLeft,
      onMemberReady: handleMemberReady,
      onPhaseChanged: handlePhaseChanged,
    }
  );

  // Connect WebSocket when session becomes active
  useEffect(() => {
    if (sessionState.active && sessionState.code && sessionState.myName) {
      connect();
    }
  }, [sessionState.active, sessionState.code, sessionState.myName, connect]);

  // Check for existing session on page load and attempt to rejoin
  useEffect(() => {
    // Only run once on mount when isRejoining is null (not checked yet)
    if (isRejoining !== null) return;

    const sessionCode = searchParams.get("session");
    const savedName = localStorage.getItem(STORAGE_KEY);

    if (sessionCode && savedName) {
      console.log("Rejoining session", sessionCode, "as", savedName);
      rejoinSession(sessionCode, savedName)
        .then((response) => {
          const members = response.Session.members.map((member) => member.name);
          const host = response.Session.members.find(
            (member) => member.host
          ).name;
          const ready = {};
          members.forEach((m) => (ready[m] = false));
          setSessionState({
            active: true,
            code: sessionCode,
            members: members,
            host: host,
            myName: savedName,
            title: response.Session.title,
            ready: ready,
            phase: "lobby",
          });
        })
        .catch(() => {
          // Session no longer exists or rejoin failed - clear URL and show home
          console.log("Rejoining session failed");
          localStorage.removeItem(STORAGE_KEY);
          router.replace("/");
        })
        .finally(() => {
          setIsRejoining(false);
        });
    }
  }, [isRejoining]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCancelClick = () => {
    setHostClicked(false);
    setJoinClicked(false);
  };

  const handleHostSessionClick = () => {
    const payload = {
      name: sessionConfig.name,
      title: sessionConfig.title,
      config: {
        anonymity: sessionConfig.anonymity,
        voting_mode: sessionConfig.voting_mode,
        min_choices: sessionConfig.min_choices,
        max_choices: sessionConfig.max_choices,
        grace_period_seconds: sessionConfig.grace_period_seconds,
        allow_empty_voters: sessionConfig.allow_empty_voters,
      },
    };

    setIsLoading(true);

    hostSession(payload)
      .then((response) => {
        localStorage.setItem(STORAGE_KEY, payload.name);
        router.replace(`/?session=${response.Code}`);
        setSessionState({
          active: true,
          code: response.Code,
          members: [payload.name],
          host: payload.name,
          myName: payload.name,
          title: sessionConfig.title,
          ready: { [payload.name]: false },
          phase: "lobby",
        });
        setIsLoading(false);
      })
      .catch(() => {
        setErrorMessage({
          ...errorMessage,
          visible: true,
        });
      });
  };

  const handleJoinSessionClick = () => {
    setIsLoading(true);
    joinSession(joinCode, joinName)
      .then((response) => {
        const members = response.Session.members.map((member) => member.name);
        const host = response.Session.members.find(
          (member) => member.host
        ).name;
        // Initialize ready state for all members as false. Will be updated when WebSocket messages arrive
        const ready = {};
        members.forEach((m) => (ready[m] = false));
        localStorage.setItem(STORAGE_KEY, joinName);
        router.replace(`/?session=${joinCode}`);
        setSessionState({
          active: true,
          code: joinCode,
          members: members,
          host: host,
          myName: joinName,
          title: response.Session.title,
          ready: ready,
          phase: "lobby",
        });
        setIsLoading(false);
      })
      .catch(() => {
        setErrorMessage({
          text: "Failed to join session. Are you sure your code was correct?",
          visible: true,
        });
      });
  };

  if (isRejoining) {
    return (
      <div className="flex justify-center items-center h-200 flex-col">
        <h1 className="self-center text-7xl font-bold">Consensus</h1>
        <Spinner className="size-8 mt-8" />
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center h-200 flex-col">
      <h1 className="self-center text-7xl font-bold">Consensus</h1>
      {!errorMessage.visible && !sessionState.active && (
        <>
          {!(hostClicked || joinClicked) && (
            <>
              <Image
                src="/temp-logo.svg"
                alt="Placeholder Logo"
                width={500}
                height={500}
                loading="eager"
              />
              <div>
                To begin, <Button onClick={() => setJoinClicked(true)}>Join</Button> or{" "}
                <Button onClick={() => setHostClicked(true)}>Host</Button> a session
              </div>
            </>
          )}

          {hostClicked && (
            <Card className="w-full max-w-sm m-10">
              <CardHeader>
                <CardTitle>Host a Session</CardTitle>
                <CardDescription>Choose options</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col space-x-2 gap-4">
                <div>
                  <div>Session Title</div>
                  <Input
                    id="session-title"
                    placeholder="Title"
                    className="w-100% mt-2 mb-4"
                    value={sessionConfig.title}
                    onChange={(e) => {
                      setSessionConfig({
                        ...sessionConfig,
                        title: e.target.value,
                      });
                    }}
                  />
                </div>
                <div>
                  <div>Your Name</div>
                  <Input
                    id="host-name"
                    placeholder="Name"
                    className="w-100% mt-2 mb-4"
                    value={sessionConfig.name}
                    onChange={(e) => {
                      setSessionConfig({
                        ...sessionConfig,
                        name: e.target.value,
                      });
                    }}
                  />
                </div>
                <div>Options</div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="anonymize-votes"
                    checked={sessionConfig.anonymity}
                    onCheckedChange={(checked) => {
                      setSessionConfig({
                        ...sessionConfig,
                        anonymity: Boolean(checked),
                      });
                    }}
                  />
                  <Label>Anonymize votes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="allow-everyone-to-vote"
                    checked={sessionConfig.allow_empty_voters}
                    onCheckedChange={(checked) => {
                      setSessionConfig({
                        ...sessionConfig,
                        allow_empty_voters: Boolean(checked),
                      });
                    }}
                  />
                  <Label>Allow everyone to vote</Label>
                </div>
                <br />
                <div className="flex flex-col gap-2">
                  <Label className="inline-block mb-1">Number of choices</Label>
                  <div className="flex flex-row space-x-4">
                    <div className="flex items-center gap-2">
                      <Label>Min:</Label>
                      <Input
                        id="min-players"
                        placeholder="1"
                        className="w-12"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label>Max:</Label>
                      <Input
                        id="max-players"
                        placeholder="3"
                        className="w-12"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-4 mt-4">
                  <Label>Voting mode</Label>
                  <div className="flex flex-row space-x-2 gap-2">
                    <RadioGroup
                      value={sessionConfig.voting_mode}
                      onValueChange={(value) => {
                        setSessionConfig({
                          ...sessionConfig,
                          voting_mode: value,
                        });
                      }}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem
                          id="yes-no"
                          value="yes_no"
                          defaultChecked
                        />
                        <Label>Yes/No</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem
                          id="ranked-choice"
                          value="ranked_choice"
                        />
                        <Label>Ranked Choice</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
                {!isLoading && 
                  <div className="flex items-center justify-evenly mt-6">
                    <Button
                      variant="outline"
                      className="w-20"
                      onClick={handleCancelClick}
                    >
                      Cancel
                    </Button>
                    <Button className="w-30" onClick={handleHostSessionClick}>
                      Host Session
                    </Button>
                  </div>}
                {isLoading && <Spinner className="self-center size-8 mt-4" />}
              </CardContent>
            </Card>
          )}

          {joinClicked && (
            <Card className="w-full max-w-sm m-10">
              <CardHeader>
                <CardTitle>Join a Session</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center space-x-2 gap-2">
                  <Input
                    id="host-name"
                    placeholder="Name"
                    className="mb-4"
                    value={joinName}
                    onChange={(e) => {
                      setJoinName(e.target.value);
                    }}
                  />
                  <InputOTP
                    maxLength={6}
                    pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
                    value={joinCode}
                    onChange={(code) => setJoinCode(code)}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSeparator />
                      <InputOTPSlot index={1} />
                      <InputOTPSeparator />
                      <InputOTPSlot index={2} />
                      <InputOTPSeparator />
                      <InputOTPSlot index={3} />
                      <InputOTPSeparator />
                      <InputOTPSlot index={4} />
                      <InputOTPSeparator />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                  <div className="text-center text-sm">
                    Enter your join code
                  </div>
                </div>
                <div className="flex items-center justify-evenly mt-6">
                  {!isLoading && (
                    <>
                      <Button
                        variant="outline"
                        className="w-20"
                        onClick={handleCancelClick}
                      >
                        Cancel
                      </Button>
                      <Button className="w-30" onClick={handleJoinSessionClick}>
                        Join Session
                      </Button>
                    </>
                  )}
                  {isLoading && <Spinner className="self-center size-8 mt-4" />}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {sessionState.active && sessionState.phase === "lobby" && (
        <Card className="w-full max-w-sm m-10">
          <CardHeader>
            <CardTitle className="text-2xl">{sessionState.title}</CardTitle>
            <CardDescription className="text-lg">
              Join Code: {sessionState.code.toUpperCase()}
            </CardDescription>
            <CardAction>
              <Button
                variant={sessionState.ready[sessionState.myName] ? "outline" : "default"}
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
                    className={`w-2 h-2 rounded-full ${sessionState.ready[member] ? "bg-green-500" : "bg-gray-300"}`}
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

      {errorMessage.visible && (
        <Card>
          <CardHeader>
            <CardTitle>Uh Oh!</CardTitle>
            <CardDescription>{errorMessage.text}</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
