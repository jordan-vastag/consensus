"use client";

import { hostSession, joinSession } from "@/app/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp";
import Image from "next/image";
import { useState } from "react";

function Start() {
  const [isLoading, setIsLoading] = useState(false);
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
  });

  const handleHostClick = () => {
    setHostClicked(true);
  };

  const handleJoinClick = () => {
    setJoinClicked(true);
  };

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
        let members = [];
        members.push(payload.name);
        setSessionState({
          active: true,
          code: response.Code,
          members: members,
          host: payload.name,
          title: sessionConfig.title,
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
        setSessionState({
          active: true,
          code: joinCode,
          members: members,
          host: host,
          title: response.Session.title,
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

  const handleStartSessionClick = () => {
    setIsLoading(true);
    // TODO
  };

  return (
    <div className="flex justif`y-center items-center h-200 flex-col">
      <h1 className="self-center text-7xl font-bold">Consensus</h1>
      {!errorMessage.visible && !sessionState.active && (
        <>
          {!(hostClicked || joinClicked) && (
            <>
              <Image
                src="/dns-svgrepo-com.svg"
                alt="Placeholder Logo"
                width={500}
                height={500}
              />
              <div>
                To begin, <Button onClick={handleJoinClick}>Join</Button> or{" "}
                <Button onClick={handleHostClick}>Host</Button> a session
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
                </div>
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
                  {isLoading && <Spinner className="size-8 mt-4" />}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {sessionState.active && (
        <Card className="w-full max-w-sm m-10">
          <CardHeader>
            <CardTitle className="text-2xl">{sessionState.title}</CardTitle>
            <CardDescription className="text-lg">
              Join Code: {sessionState.code.toUpperCase()}
            </CardDescription>
            <CardAction>
              <div className="flex items-center">
                {isLoading && <Spinner className="size-8 mt-4" />}
                {!isLoading && (
                  <Button className="w-30" onClick={handleStartSessionClick}>
                    Start Session
                  </Button>
                )}
              </div>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="text-md underline">Members</div>
            <ul>
              {sessionState?.members.map((member) =>
                member === sessionState.host ? (
                  <li key={member}>{member} (host)</li>
                ) : (
                  <li key={member}>{member}</li>
                )
              )}
            </ul>
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

export { Start };
