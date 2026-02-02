"use client";

import { hostSession } from "@/app/api";
import { Button } from "@/ui/button";
import {
  Card,
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
import { useRouter } from "next/navigation";
import { useState } from "react";

const SESSION_KEY = "consensus_session_data";

function getSavedSession() {
  if (typeof window === "undefined") return null;
  const saved = localStorage.getItem(SESSION_KEY);
  if (!saved) return null;
  const parsed = JSON.parse(saved);
  return parsed?.code && parsed?.name ? parsed : null;
}

export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [savedSessionData, setSavedSessionData] = useState(getSavedSession);
  const [hostClicked, setHostClicked] = useState(false);
  const [joinClicked, setJoinClicked] = useState(false);
  const [joinCode, setJoinCode] = useState("");
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
  const [touched, setTouched] = useState({
    name: false,
    title: false,
  });

  const nameHasInvalidChars = /[/\\]/.test(sessionConfig.name);
  const isFormValid =
    sessionConfig.name.trim() !== "" &&
    !nameHasInvalidChars &&
    sessionConfig.title.trim() !== "";

  const showRejoinPrompt = savedSessionData !== null;

  const handleCancelClick = () => {
    localStorage.removeItem(SESSION_KEY);
    setHostClicked(false);
    setJoinClicked(false);
    setSavedSessionData(null);
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
        localStorage.setItem(
          SESSION_KEY,
          JSON.stringify({
            name: payload.name,
            code: response.Code,
          })
        );
        router.push(`/s/${response.Code}`);
      })
      .catch(() => {
        setErrorMessage({
          ...errorMessage,
          visible: true,
        });
        setIsLoading(false);
      });
  };

  const handleJoinSessionClick = () => {
    if (joinCode.length === 6) {
      router.push(`/s/${joinCode.toLowerCase()}`);
    }
  };

  const handleRejoinClick = () => {
    if (savedSessionData?.code) {
      router.push(`/s/${savedSessionData.code}`);
    }
  };

  return (
    // TODO: form input validation

    <div className="flex justify-center items-center h-200 flex-col">
      <h1 className="self-center text-7xl font-bold">Consensus</h1>

      {!errorMessage.visible && !showRejoinPrompt && (
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
                To begin,{" "}
                <Button onClick={() => setJoinClicked(true)}>Join</Button> or{" "}
                <Button onClick={() => setHostClicked(true)}>Host</Button> a
                session
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
                  <div>Session Title <span className="text-destructive">*</span></div>
                  <Input
                    id="session-title"
                    placeholder="Title"
                    className={`w-100% mt-2 ${touched.title && !sessionConfig.title.trim() ? "border-destructive" : ""}`}
                    value={sessionConfig.title}
                    onChange={(e) => {
                      setSessionConfig({
                        ...sessionConfig,
                        title: e.target.value,
                      });
                    }}
                    onBlur={() => setTouched({ ...touched, title: true })}
                  />
                  {touched.title && !sessionConfig.title.trim() && (
                    <p className="text-destructive text-sm mt-1">Title is required</p>
                  )}
                </div>
                <div>
                  <div>Your Name <span className="text-destructive">*</span></div>
                  <Input
                    id="host-name"
                    placeholder="Name"
                    className={`w-100% mt-2 ${(touched.name && !sessionConfig.name.trim()) || nameHasInvalidChars ? "border-destructive" : ""}`}
                    value={sessionConfig.name}
                    onChange={(e) => {
                      setSessionConfig({
                        ...sessionConfig,
                        name: e.target.value,
                      });
                    }}
                    onBlur={() => setTouched({ ...touched, name: true })}
                  />
                  {touched.name && !sessionConfig.name.trim() && (
                    <p className="text-destructive text-sm mt-1">Name is required</p>
                  )}
                  {nameHasInvalidChars && (
                    <p className="text-destructive text-sm mt-1">Name cannot contain / or \</p>
                  )}
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
                {!isLoading && (
                  <div className="flex items-center justify-evenly mt-6">
                    <Button
                      variant="outline"
                      className="w-20"
                      onClick={handleCancelClick}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="w-30"
                      onClick={handleHostSessionClick}
                      disabled={!isFormValid}
                    >
                      Host Session
                    </Button>
                  </div>
                )}
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
                  <div className="text-center text-sm">Join code</div>
                </div>
                <div className="flex items-center justify-evenly mt-6">
                  <Button
                    variant="outline"
                    className="w-20"
                    onClick={handleCancelClick}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="w-30"
                    onClick={handleJoinSessionClick}
                    disabled={joinCode.length !== 6}
                  >
                    Join Session
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {showRejoinPrompt && savedSessionData && (
        <Card className="w-full max-w-sm m-10">
          <CardHeader>
            <CardTitle>
              Hi {savedSessionData.name}, looks like you got disconnected!
            </CardTitle>
            <CardDescription>
              Would you like to rejoin your previous session?
            </CardDescription>
            <CardDescription>
              Code: {savedSessionData.code.toUpperCase()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-evenly mt-2">
              <Button
                variant="outline"
                className="w-20"
                onClick={handleCancelClick}
              >
                No
              </Button>
              <Button className="w-30" onClick={handleRejoinClick}>
                Yes
              </Button>
            </div>
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
