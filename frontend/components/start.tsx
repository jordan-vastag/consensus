"use client";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp";
import Image from "next/image";
import { useState } from "react";
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSeparator,
    InputOTPSlot,
} from "./ui/input-otp";

function Start() {
  const [hostClicked, setHostClicked] = useState(false);
  const [joinClicked, setJoinClicked] = useState(false);
  const [startClicked, setStartClicked] = useState(false);

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

  const handleStartClick = () => {
    setStartClicked(true);
  };

  return (
    <>
      <div className="flex justify-center items-center h-200 flex-col">
        <h1 className="self-center text-7xl font-bold">Consensus</h1>
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
              <CardDescription>
                Choose options then click Start to begin
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col space-x-2 gap-4">
              <div>Options</div>
              <div className="flex items-center space-x-2">
                <Checkbox />
                <Label>Anonymize votes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox />
                <Label>Allow everyone to vote</Label>
              </div>
              <br />
              <div className="flex flex-col gap-2">
                <Label className="inline-block">Number of choices</Label>
                <div className="flex flex-row space-x-2 gap-2">
                  <Input placeholder="Max" className="w-2xs" />
                  <Input placeholder="Min" className="w-2xs" />
                </div>
              </div>
              <div className="flex flex-col gap-4 mt-8">
                <Label>Voting mode</Label>
                <div className="flex flex-row space-x-2 gap-2">
                  <RadioGroup>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="ranked-choice" />
                      <Label>Ranked Choice</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes-no" />
                      <Label>Yes/No</Label>
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
                <Button className="w-30" onClick={handleStartClick}>
                  Start
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
                <InputOTP maxLength={4} pattern={REGEXP_ONLY_DIGITS_AND_CHARS}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSeparator />
                    <InputOTPSlot index={1} />
                    <InputOTPSeparator />
                    <InputOTPSlot index={2} />
                    <InputOTPSeparator />
                    <InputOTPSlot index={3} />
                  </InputOTPGroup>
                </InputOTP>
                <div className="text-center text-sm">Enter your join code</div>
              </div>
              <div className="flex items-center justify-evenly mt-6">
                <Button
                  variant="outline"
                  className="w-20"
                  onClick={handleCancelClick}
                >
                  Cancel
                </Button>
                <Button className="w-30" onClick={handleStartClick}>
                  Start
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

export { Start };
