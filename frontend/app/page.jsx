"use client";

import { getSession, hostSession, sendUserMessage } from "@/app/api";
import { Logo } from "@/components/logo";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/ui/accordion";
import { Button } from "@/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { RadioGroup, RadioGroupItem } from "@/ui/radio-group";
import { Spinner } from "@/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";
import { Textarea } from "@/ui/textarea";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const SESSION_KEY = "consensus_session_data";
const PAST_SESSIONS_KEY = "consensus_past_sessions";
function getSavedSession() {
  if (typeof window === "undefined") return null;
  const saved = localStorage.getItem(SESSION_KEY);
  if (!saved) return null;
  const parsed = JSON.parse(saved);
  return parsed?.code && parsed?.name ? parsed : null;
}
function getPastSessions() {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(PAST_SESSIONS_KEY) || "[]");
  } catch {
    return [];
  }
}

export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [savedSessionData, setSavedSessionData] = useState(null);
  const [infoView, setInfoView] = useState(null);
  const [contactForm, setContactForm] = useState({ name: "", email: "", message: "" });
  const [contactState, setContactState] = useState({ loading: false, error: "", submitted: false });
  const FEEDBACK_KEY = "consensus_feedback_last_submitted";
  const MAX_MESSAGE_LENGTH = 1000;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setContactState({ loading: false, error: "", submitted: false });
    const last = typeof window !== "undefined" ? localStorage.getItem(FEEDBACK_KEY) : null;
    if (last && Date.now() - parseInt(last, 10) < 15 * 60 * 1000) {
      setContactState({ loading: false, error: "You just sent a message. Please try again later.", submitted: false });
      return;
    }
    if (!contactForm.name.trim()) {
      setContactState({ loading: false, error: "Name is required.", submitted: false });
      return;
    }
    if (!contactForm.message.trim()) {
      setContactState({ loading: false, error: "Message cannot be empty.", submitted: false });
      return;
    }
    if (contactForm.email.trim() && !emailRegex.test(contactForm.email.trim())) {
      setContactState({ loading: false, error: "Please enter a valid email address.", submitted: false });
      return;
    }
    setContactState({ loading: true, error: "", submitted: false });
    try {
      await sendUserMessage({
        name: contactForm.name.trim(),
        email: contactForm.email.trim(),
        message: contactForm.message.trim(),
      });
      localStorage.setItem(FEEDBACK_KEY, Date.now().toString());
      setContactState({ loading: false, error: "", submitted: true });
    } catch {
      setContactState({ loading: false, error: "Failed to send message. Please try again later.", submitted: false });
    }
  };
  const [pastSessions, setPastSessions] = useState([]);
  const infoOpen = infoView !== null;

  useEffect(() => {
    setSavedSessionData(getSavedSession());
    setPastSessions(getPastSessions());
  }, []);
  const [activeTab, setActiveTab] = useState("join");
  const [joinCode, setJoinCode] = useState("");
  const [joinCodeTouched, setJoinCodeTouched] = useState(false);
  const [errorMessage, setErrorMessage] = useState({
    visible: false,
    text: "Something went wrong. Please reload the page and try again later if the problem persists.",
  });
  const [sessionConfig, setSessionConfig] = useState({
    name: "",
    title: "",
    anonymity: false,
    voting_mode: "yes_no",
    integration: "",
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
        integration: sessionConfig.integration,
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
            title: payload.title,
            host: true,
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

  const [joinError, setJoinError] = useState("");

  const handleJoinSessionClick = async () => {
    if (joinCode.length !== 6) return;
    setJoinError("");
    setIsLoading(true);
    try {
      const response = await getSession(joinCode.toLowerCase());
      const phase = response.Session.phase || "lobby";
      const closedAt = new Date(response.Session.closed_at);
      if (closedAt.getFullYear() > 1) {
        setJoinError("This session is closed.");
      } else if (phase !== "lobby") {
        setJoinError("This session is no longer accepting new members.");
      } else {
        router.push(`/s/${joinCode.toLowerCase()}`);
        return;
      }
    } catch {
      setJoinError("Session not found.");
    }
    setIsLoading(false);
  };

  const handleRejoinClick = () => {
    if (savedSessionData?.code) {
      router.push(`/s/${savedSessionData.code}`);
    }
  };

  return (
    <div className="flex justify-center items-center h-200 flex-col">
      <Logo autoPlay />

      {!errorMessage.visible && !showRejoinPrompt && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full max-w-sm mt-6">
          <div className="flex items-center gap-2">
            {!infoOpen && (
              <TabsList className="grid flex-1 grid-cols-2">
                <TabsTrigger value="join">Join</TabsTrigger>
                <TabsTrigger value="host">Host</TabsTrigger>
              </TabsList>
            )}
            <button
              className="cursor-pointer opacity-60 hover:opacity-100 transition-opacity p-2 ml-auto"
              aria-label={infoOpen ? "Close" : "Info"}
              onClick={() => {
                if (infoOpen) {
                  setInfoView(null);
                } else {
                  setPastSessions(getPastSessions());
                  setInfoView("menu");
                }
              }}
            >
              <Image
                src={infoOpen ? "/cross.svg" : "/menu-burger.svg"}
                alt={infoOpen ? "Close" : "Info"}
                title={infoOpen ? "Close" : "Info"}
                width={20}
                height={20}
              />
            </button>
          </div>
          {infoOpen && (
            <Card className="mt-2">
              <CardHeader>
                <CardTitle>Menu</CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible>
                  <AccordionItem value="past_results">
                    <AccordionTrigger className="cursor-pointer">Past Results</AccordionTrigger>
                    <AccordionContent>
                      {pastSessions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No results available.</p>
                      ) : (
                        <ul className="flex flex-col gap-2 list-disc pl-5">
                          {pastSessions.map((s) => (
                            <li key={s.permalink}>
                              <div
                                className="group text-left text-sm cursor-pointer w-full flex items-center"
                                onClick={() => router.push(`/results/${s.permalink}`)}
                              >
                                <span className="font-medium group-hover:underline">{s.title || "Untitled"}</span>
                                <Image
                                  src="/link-alt.svg"
                                  alt="Open"
                                  width={14}
                                  height={14}
                                  className="ml-2 opacity-0 group-hover:opacity-60 transition-opacity"
                                />
                                {s.date && (
                                  <span className="text-muted-foreground ml-auto text-xs">
                                    {new Date(s.date).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="how-to-use">
                    <AccordionTrigger className="cursor-pointer">How to Use</AccordionTrigger>
                    <AccordionContent>
                      <p>Host or join a session, add your choices, and vote!</p>
                      <p className="mt-2">
                        Voting results are saved permanently - simply bookmark the results page and view them anytime.
                      </p>
                      <p className="mt-4 mb-2 font-medium">Session Options</p>
                      <ul className="flex flex-col gap-2 list-disc pl-5">
                        <li><b>Voting mode</b></li>
                        <ul className="list-disc pl-5 gap-1 flex flex-col">
                          <li><i>Yes/No:</i> For each choice, vote yes or no</li>
                          <li><i>Ranked Choice:</i> Order choices by preference</li>
                        </ul>
                        <li><b>Choice style</b></li>
                        <ul className="list-disc pl-5 gap-1 flex flex-col">
                          <li><i>Simple:</i> Plain text title and description</li>
                          <li><i>Movie (TMDB):</i> Search TMDB for film titles</li>
                        </ul>
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="about">
                    <AccordionTrigger className="cursor-pointer">About</AccordionTrigger>
                    <AccordionContent>
                      <p>Built with <a href="https://reactjs.org" className="underline hover:no-underline text-blue-800" target="_blank" rel="noopener noreferrer">React</a> + <a href="https://tailwindcss.com" className="underline hover:no-underline text-blue-800" target="_blank" rel="noopener noreferrer">Tailwind CSS</a> using <a href="https://ui.shadcn.com" className="underline hover:no-underline text-blue-800" target="_blank" rel="noopener noreferrer">shadcn UI</a> components, <a href="https://golang.org" className="underline hover:no-underline text-blue-800" target="_blank" rel="noopener noreferrer">Go</a>, and <a href="https://www.mongodb.com" className="underline hover:no-underline text-blue-800" target="_blank" rel="noopener noreferrer">MongoDB</a>. </p>
                      <p className="mt-2 mb-4">View the project on <a href="https://github.com/jordan-vastag/consensus" className="underline hover:no-underline text-blue-800" target="_blank" rel="noopener noreferrer">GitHub</a>.</p>
                      <hr />
                      <p className="mt-4 mb-2">Icon Attribution</p>
                      <ul className="flex flex-col gap-2 list-disc pl-5 mb-4">
                        <li>UI &quot;Uicons&quot; by <a href="https://www.flaticon.com/uicons" className="underline hover:no-underline text-blue-800">Flaticon</a></li>
                        <li>&quot;Organization animated icon&quot; (logo) created by Freepik on <a href="https://www.flaticon.com/free-animated-icons/organization" title="organization animated icons" className="underline hover:no-underline text-blue-800">Flaticon</a></li>
                      </ul>
                      <hr />
                      <p className="mt-4 mb-2">Thanks to <a href="https://www.themoviedb.org" className="underline hover:no-underline text-blue-800" target="_blank" rel="noopener noreferrer">TMDB</a> for the API access!</p>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="contact">
                    <AccordionTrigger className="cursor-pointer">Contact Us</AccordionTrigger>
                    <AccordionContent>
                      <p className="mb-3">Have questions, feedback, or suggestions? We&apos;d love to hear from you!</p>
                      {contactState.submitted ? (
                        <p className="text-sm">Thank you for your feedback!</p>
                      ) : (
                        <form onSubmit={handleContactSubmit} className="flex flex-col gap-3">
                          <div>
                            <Label htmlFor="contact-name">Name <span className="text-destructive">*</span></Label>
                            <Input
                              id="contact-name"
                              placeholder="Your name"
                              maxLength={50}
                              className="mt-1"
                              value={contactForm.name}
                              onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                              disabled={contactState.loading}
                            />
                          </div>
                          <div>
                            <Label htmlFor="contact-email">Email <span className="text-muted-foreground text-xs">(optional)</span></Label>
                            <Input
                              id="contact-email"
                              type="email"
                              placeholder="you@example.com"
                              className="mt-1"
                              value={contactForm.email}
                              onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                              disabled={contactState.loading}
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between">
                              <Label htmlFor="contact-message">Message <span className="text-destructive">*</span></Label>
                              <span className="text-xs text-muted-foreground">{contactForm.message.length}/{MAX_MESSAGE_LENGTH}</span>
                            </div>
                            <Textarea
                              id="contact-message"
                              placeholder="Your message"
                              rows={5}
                              maxLength={MAX_MESSAGE_LENGTH}
                              className="mt-1"
                              value={contactForm.message}
                              onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                              disabled={contactState.loading}
                            />
                          </div>
                          {contactState.error && (
                            <p className="text-destructive text-sm">{contactState.error}</p>
                          )}
                          <Button type="submit" disabled={contactState.loading}>
                            {contactState.loading ? "Sending..." : "Send Message"}
                          </Button>
                        </form>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          )}

          {!infoOpen && (<>
          <TabsContent value="join">
            <Card>
              <CardHeader>
                <CardTitle>Join a Session</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  placeholder="Enter join code"
                  maxLength={6}
                  value={joinCode}
                  onChange={(e) => {
                    setJoinCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ""));
                    setJoinCodeTouched(false);
                  }}
                  onBlur={() => { if (joinCode.length > 0) setJoinCodeTouched(true); }}
                />
                {joinCodeTouched && joinCode.length > 0 && joinCode.length < 6 && (
                  <p className="text-destructive text-sm mt-1">Join code must be 6 alphanumeric characters</p>
                )}
                {joinError && (
                  <p className="text-destructive text-sm text-center mt-2">{joinError}</p>
                )}
                {!isLoading && (
                  <div className="flex items-center justify-center mt-6">
                    <Button
                      className="w-30"
                      onClick={handleJoinSessionClick}
                      disabled={joinCode.length !== 6}
                    >
                      Join
                    </Button>
                  </div>
                )}
                {isLoading && <div className="flex justify-center mt-4"><Spinner className="size-8" /></div>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="host">
            <Card>
              <CardHeader>
                <CardTitle>Host a Session</CardTitle>
                <CardDescription>Choose options</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col space-x-2 gap-4">
                <div>
                  <div className="flex justify-between items-center">
                    <div>Session Title <span className="text-destructive">*</span></div>
                    <span className={`text-xs ${30 - sessionConfig.title.length <= 5 ? "text-destructive" : "text-muted-foreground"}`}>{30 - sessionConfig.title.length}</span>
                  </div>
                  <Input
                    id="session-title"
                    placeholder="Title"
                    maxLength={30}
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
                  <div className="flex justify-between items-center">
                    <div>Your Name <span className="text-destructive">*</span></div>
                    <span className={`text-xs ${20 - sessionConfig.name.length <= 5 ? "text-destructive" : "text-muted-foreground"}`}>{20 - sessionConfig.name.length}</span>
                  </div>
                  <Input
                    id="host-name"
                    placeholder="Name"
                    maxLength={20}
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
                {/* <div className="flex items-center space-x-2">
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
                </div> */}
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
                <div className="flex flex-col gap-4 mt-4">
                  <Label>Choice Style</Label>
                  <div className="flex flex-row space-x-2 gap-2">
                    <RadioGroup
                      value={sessionConfig.integration}
                      onValueChange={(value) => {
                        setSessionConfig({
                          ...sessionConfig,
                          integration: value,
                        });
                      }}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem id="integration-none" value="" />
                        <Label>Simple (text input)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem id="integration-tmdb" value="tmdb" />
                        <Label>Movie (TMDB)</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
                {!isLoading && (
                  <div className="flex items-center justify-center mt-6">
                    <Button
                      className="w-30"
                      onClick={handleHostSessionClick}
                      disabled={!isFormValid}
                    >
                      Start
                    </Button>
                  </div>
                )}
                {isLoading && <Spinner className="self-center size-8 mt-4" />}
              </CardContent>
            </Card>
          </TabsContent>
          </>)}
        </Tabs>
      )}

      {showRejoinPrompt && savedSessionData && (
        <Card className="w-full max-w-sm m-10">
          <CardHeader>
            <CardTitle>
              Hi <i>{savedSessionData.name}</i>, looks like you got disconnected!
            </CardTitle>
            <CardDescription>
              Would you like to rejoin your previous session?
            </CardDescription>
            {savedSessionData.title && (
              <CardDescription className="mt-2 text-md">
                <b>{savedSessionData.title}</b> (Code: {savedSessionData.code.toUpperCase()})
              </CardDescription>
            )}
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
