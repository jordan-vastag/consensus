"use client";

import {
  addChoice,
  clearChoices,
  closeSession,
  getMemberChoices,
  getSession,
  joinSession,
  leaveSession,
  removeChoice,
  submitVotes,
  updateSessionConfig,
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
import { Checkbox } from "@/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/ui/dialog";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { RadioGroup, RadioGroupItem } from "@/ui/radio-group";
import { Spinner } from "@/ui/spinner";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";
import { toast } from "sonner";

const SESSION_KEY = "consensus_session_data";

function UserBadge({ name }) {
  return (
    <div className="flex items-center gap-1.5 text-md text-muted-foreground">
      <i>{name}</i>
    </div>
  );
}

function SortableChoiceItem({ id, title, rank, totalChoices, onRankChange }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 py-2 px-3 rounded-md bg-muted"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none p-1 text-muted-foreground hover:text-foreground"
        aria-label="Drag to reorder"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="5" cy="3" r="1.5" />
          <circle cx="11" cy="3" r="1.5" />
          <circle cx="5" cy="8" r="1.5" />
          <circle cx="11" cy="8" r="1.5" />
          <circle cx="5" cy="13" r="1.5" />
          <circle cx="11" cy="13" r="1.5" />
        </svg>
      </button>
      <span className="flex-1 truncate">{title}</span>
      <input
        type="text"
        inputMode="numeric"
        value={rank}
        onChange={(e) => {
          const val = parseInt(e.target.value, 10);
          if (!isNaN(val) && val >= 1 && val <= totalChoices) {
            onRankChange(val);
          }
        }}
        className="w-12 text-center rounded border border-input bg-background px-1 py-0.5 text-sm [appearance:textfield]"
      />
    </li>
  );
}

export default function SessionPage() {
  const router = useRouter();
  const params = useParams();
  const sessionCode = params.code?.toLowerCase();

  const [isLoading, setIsLoading] = useState(true);
  const [joinName, setJoinName] = useState("");
  const [nameValidation, setNameValidation] = useState("idle"); // idle, checking, valid, invalid
  const [needsToJoin, setNeedsToJoin] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [choices, setChoices] = useState([]);
  const [allChoices, setAllChoices] = useState([]);
  const [newChoiceTitle, setNewChoiceTitle] = useState("");
  const [localVotes, setLocalVotes] = useState({});
  const [currentChoiceIndex, setCurrentChoiceIndex] = useState(0);
  const [inVoteReview, setInVoteReview] = useState(false);
  const [rankedOrder, setRankedOrder] = useState([]); // array of choice titles in ranked order
  const [editingChoiceTitle, setEditingChoiceTitle] = useState(null);
  const [editingListChoiceTitle, setEditingListChoiceTitle] = useState(null);
  const [editingListChoiceValue, setEditingListChoiceValue] = useState("");
  const [isLeavingSession, setIsLeavingSession] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [editConfig, setEditConfig] = useState(null);
  const [closedCountdown, setClosedCountdown] = useState(null);
  const [sessionState, setSessionState] = useState({
    active: false,
    code: "",
    members: [],
    host: "",
    myName: "",
    title: "",
    ready: {},
    submitted: {},
    voted: {},
    phase: "lobby",
    config: {
      min_choices: 0,
      max_choices: 10,
    },
  });

  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const isRankedChoice = sessionState.config?.voting_mode === "ranked_choice";

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setRankedOrder((prev) => {
      const oldIndex = prev.indexOf(active.id);
      const newIndex = prev.indexOf(over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const handleRankInputChange = useCallback((title, newRank) => {
    setRankedOrder((prev) => {
      const oldIndex = prev.indexOf(title);
      const newIndex = newRank - 1; // 1-based to 0-based
      if (oldIndex === -1 || oldIndex === newIndex) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

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

  const handlePhaseChanged = useCallback((phase, readyMap, choices, permalink) => {
    if (phase === "final" && permalink) {
      localStorage.removeItem(SESSION_KEY);
      router.push(`/results/${permalink}`);
      return;
    }
    setSessionState((prev) => ({
      ...prev,
      phase,
      ready: readyMap,
    }));
    if (phase === "results") {
      setAllChoices(choices?.length > 0 ? choices : []);
      setLocalVotes({});
      setCurrentChoiceIndex(0);
      setInVoteReview(false);
      if (choices?.length > 0) {
        setRankedOrder(choices.map((c) => c.title));
      }
    } else if (choices?.length > 0) {
      setAllChoices(choices);
    }
  }, [router]);

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

  const handleMemberSubmitted = useCallback((memberName) => {
    setSessionState((prev) => ({
      ...prev,
      submitted: { ...prev.submitted, [memberName]: true },
    }));
  }, []);

  const handleMemberVoted = useCallback((memberName) => {
    setSessionState((prev) => ({
      ...prev,
      voted: { ...prev.voted, [memberName]: true },
    }));
  }, []);

  const handleSessionClosed = useCallback(() => {
    setClosedCountdown(3);
  }, []);

  const handleConfigUpdated = useCallback((config) => {
    setSessionState((prev) => ({ ...prev, config: { ...prev.config, ...config } }));
  }, []);

  const handleHostChanged = useCallback((newHost) => {
    setSessionState((prev) => {
      // Update localStorage with new host status
      const savedSession = JSON.parse(localStorage.getItem(SESSION_KEY));
      if (savedSession) {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ ...savedSession, host: prev.myName === newHost }));
      }

      if (prev.myName === newHost) {
        toast("You are now the host");
      }

      return { ...prev, host: newHost };
    });
  }, []);

  useEffect(() => {
    if (closedCountdown === null || closedCountdown < 1) return;
    const timer = setTimeout(() => {
      if (closedCountdown === 1) {
        setClosedCountdown(null);
        localStorage.removeItem(SESSION_KEY);
        router.push("/");
      } else {
        setClosedCountdown((prev) => prev - 1);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [closedCountdown, router]);

  const { isConnected, connect, disconnect, setReady, submitChoices, submitVotes: submitVotesWS } = useSessionWebSocket(
    sessionState.code,
    sessionState.myName,
    {
      onMemberJoined: handleMemberJoined,
      onMemberLeft: handleMemberLeft,
      onMemberReady: handleMemberReady,
      onPhaseChanged: handlePhaseChanged,
      onConnectedUsers: handleConnectedUsers,
      onMemberSubmitted: handleMemberSubmitted,
      onMemberVoted: handleMemberVoted,
      onSessionClosed: handleSessionClosed,
      onConfigUpdated: handleConfigUpdated,
      onHostChanged: handleHostChanged,
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

  // Fetch finalized choices when entering results phase (fallback for reconnect)
  useEffect(() => {
    if (sessionState.phase !== "results" || !sessionState.code) return;
    getSession(sessionState.code)
      .then((response) => {
        const fc = response.Session.finalizedChoices;
        if (fc?.length > 0) {
          setAllChoices(fc);
          setRankedOrder(fc.map((c) => c.title));
        }
      })
      .catch((e) => console.error("Failed to fetch choices:", e));
  }, [sessionState.phase, sessionState.code]);

  // Redirect to permalink when entering final phase via reconnect
  useEffect(() => {
    if (sessionState.phase !== "final" || !sessionState.code) return;
    getSession(sessionState.code)
      .then((response) => {
        if (response.Session.permalink) {
          localStorage.removeItem(SESSION_KEY);
          router.push(`/results/${response.Session.permalink}`);
        }
      })
      .catch((e) => console.error("Failed to fetch session:", e));
  }, [sessionState.phase, sessionState.code, router]);

  // Compute submission status from WebSocket-tracked submitted state
  const membersWhoHaventSubmitted = sessionState.members.filter(
    (m) => !sessionState.submitted[m]
  );

  const membersWhoHaventVoted = sessionState.members.filter(
    (m) => !sessionState.voted[m]
  );

  const choicesRemaining = allChoices.filter(
    (c) => localVotes[c.title] === undefined
  ).length;

  const handleSubmitVotes = async () => {
    let votes;
    if (isRankedChoice) {
      votes = rankedOrder.map((title, index) => ({
        choiceTitle: title,
        value: index + 1, // 1-based rank
      }));
    } else {
      votes = allChoices.map((c) => ({
        choiceTitle: c.title,
        value: localVotes[c.title] ?? 0,
      }));
    }
    try {
      await submitVotes(sessionState.code, sessionState.myName, votes);
      submitVotesWS();
      setSessionState((prev) => ({
        ...prev,
        phase: "submitted_votes",
        voted: { ...prev.voted, [prev.myName]: true },
      }));
    } catch (e) {
      console.error("Failed to submit votes:", e);
      toast.error("Failed to submit votes");
    }
  };

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

  const handleEditChoice = async (oldTitle, newTitle) => {
    const trimmed = newTitle.trim();
    if (!trimmed || trimmed === oldTitle) return;
    try {
      await removeChoice(sessionState.code, sessionState.myName, oldTitle);
      await addChoice(sessionState.code, sessionState.myName, trimmed);
      setChoices((prev) => prev.map((c) => c.title === oldTitle ? { ...c, title: trimmed } : c));
    } catch (e) {
      console.error("Failed to edit choice:", e);
      toast.error("Failed to edit choice");
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
          const submitted = {};
          const voted = {};
          response.Session.members.forEach((m) => {
            ready[m.name] = false;
            if (m.submitted) submitted[m.name] = true;
            if (m.voted) voted[m.name] = true;
          });
          const phase = response.Session.phase || "lobby";

          // If session is finalized, redirect to permalink
          if (phase === "final" && response.Session.permalink) {
            localStorage.removeItem(SESSION_KEY);
            router.push(`/results/${response.Session.permalink}`);
            return;
          }

          // Notify if user was previously host but no longer is
          if (savedSession.host && host !== savedSession.name) {
            toast("You are no longer the host");
          }

          // Update localStorage with current host status
          const isNowHost = host === savedSession.name;
          localStorage.setItem(
            SESSION_KEY,
            JSON.stringify({ ...savedSession, host: isNowHost })
          );

          // If this member already submitted/voted, show the waiting screen
          const mySubmitted = submitted[savedSession.name];
          const myVoted = voted[savedSession.name];
          let effectivePhase = phase;
          if (phase === "voting" && mySubmitted) {
            effectivePhase = "submitted";
          } else if (phase === "results" && myVoted) {
            effectivePhase = "submitted_votes";
          }

          setSessionState({
            active: true,
            code: sessionCode,
            members,
            host,
            myName: savedSession.name,
            title: response.Session.title,
            ready,
            submitted,
            voted,
            phase: effectivePhase,
            config: response.Session.config,
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

  const validateName = async () => {
    if (!joinName.trim()) {
      setNameValidation("idle");
      return;
    }

    setNameValidation("checking");
    try {
      const response = await getSession(sessionCode);
      const members = response.Session.members.map((m) => m.name);
      if (members.includes(joinName.trim())) {
        setNameValidation("invalid");
      } else {
        setNameValidation("valid");
      }
    } catch (e) {
      console.error("Failed to validate name:", e);
      setNameValidation("idle");
    }
  };

  const handleJoinSessionClick = () => {
    setIsLoading(true);
    joinSession(sessionCode, joinName)
      .then((response) => {
        const members = response.Session.members.map((m) => m.name);
        const host = response.Session.members.find((m) => m.host).name;
        const ready = {};
        members.forEach((m) => (ready[m] = false));

        const isHost = response.Session.members.find((m) => m.name === joinName)?.host || false;
        localStorage.setItem(
          SESSION_KEY,
          JSON.stringify({ name: joinName, code: sessionCode, title: response.Session.title, host: isHost })
        );

        setSessionState({
          active: true,
          code: sessionCode,
          members,
          host,
          myName: joinName,
          title: response.Session.title,
          ready,
          submitted: {},
          voted: {},
          phase: "lobby",
          config: response.Session.config,
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
              <div>
                <Input
                  placeholder="Your name"
                  value={joinName}
                  onChange={(e) => {
                    setJoinName(e.target.value);
                    setNameValidation("idle");
                  }}
                  onBlur={validateName}
                />
                {nameValidation === "checking" && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <Spinner className="size-4" />
                    <span>Checking availability...</span>
                  </div>
                )}
                {nameValidation === "valid" && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-green-600">
                    <span>✅</span>
                    <span>Name is available</span>
                  </div>
                )}
                {nameValidation === "invalid" && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-destructive">
                    <span>❌</span>
                    <span>Name is already taken</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-evenly">
                <Button variant="outline" onClick={() => router.push("/")}>
                  Cancel
                </Button>
                <Button
                  onClick={handleJoinSessionClick}
                  disabled={!joinName || nameValidation !== "valid"}
                >
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
            <CardTitle className="text-2xl flex items-center gap-2">
              {sessionState.title}
              <Dialog onOpenChange={(open) => { if (!open) { setIsEditingConfig(false); setEditConfig(null); } }}>
                <DialogTrigger asChild>
                  <button
                    className="cursor-pointer opacity-60 hover:opacity-100 transition-opacity"
                    aria-label="Settings"
                  >
                    <Image src="/settings-sliders.svg" alt="Settings" title="Settings" width={20} height={20} />
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Settings</DialogTitle>
                  </DialogHeader>
                  <div className="pt-2 flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium">Session Options</div>
                      {sessionState.myName === sessionState.host && !isEditingConfig && (
                        <button
                          className="cursor-pointer opacity-60 hover:opacity-100 transition-opacity"
                          aria-label="Edit session options"
                          onClick={() => {
                            setEditConfig({
                              anonymity: sessionState.config?.anonymity || false,
                              allow_empty_voters: sessionState.config?.allow_empty_voters || false,
                              min_choices: sessionState.config?.min_choices || 0,
                              max_choices: sessionState.config?.max_choices || 0,
                              voting_mode: sessionState.config?.voting_mode || "yes_no",
                            });
                            if (sessionState.ready[sessionState.myName]) {
                              setReady(false);
                            }
                            setIsEditingConfig(true);
                          }}
                        >
                          <Image src="/edit.svg" alt="Edit" title="Edit" width={16} height={16} />
                        </button>
                      )}
                    </div>
                    {!isEditingConfig ? (
                      <div className="flex flex-col gap-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Anonymize votes</span>
                          <span>{sessionState.config?.anonymity ? "Yes" : "No"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Allow everyone to vote</span>
                          <span>{sessionState.config?.allow_empty_voters ? "Yes" : "No"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Number of choices</span>
                          <span>{sessionState.config?.min_choices || 0} - {sessionState.config?.max_choices || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Voting mode</span>
                          <span>{sessionState.config?.voting_mode === "ranked_choice" ? "Ranked Choice" : "Yes/No"}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="edit-anonymize"
                            checked={editConfig.anonymity}
                            onCheckedChange={(checked) => setEditConfig({ ...editConfig, anonymity: Boolean(checked) })}
                          />
                          <Label htmlFor="edit-anonymize">Anonymize votes</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="edit-allow-empty"
                            checked={editConfig.allow_empty_voters}
                            onCheckedChange={(checked) => setEditConfig({ ...editConfig, allow_empty_voters: Boolean(checked) })}
                          />
                          <Label htmlFor="edit-allow-empty">Allow everyone to vote</Label>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label>Number of choices</Label>
                          <div className="flex flex-row space-x-4">
                            <div className="flex items-center gap-2">
                              <Label>Min:</Label>
                              <Input
                                type="number"
                                className="w-16"
                                value={editConfig.min_choices}
                                onChange={(e) => setEditConfig({ ...editConfig, min_choices: parseInt(e.target.value, 10) || 0 })}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Label>Max:</Label>
                              <Input
                                type="number"
                                className="w-16"
                                value={editConfig.max_choices}
                                onChange={(e) => setEditConfig({ ...editConfig, max_choices: parseInt(e.target.value, 10) || 0 })}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label>Voting mode</Label>
                          <RadioGroup
                            value={editConfig.voting_mode}
                            onValueChange={(value) => setEditConfig({ ...editConfig, voting_mode: value })}
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem id="edit-yes-no" value="yes_no" />
                              <Label htmlFor="edit-yes-no">Yes/No</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem id="edit-ranked-choice" value="ranked_choice" />
                              <Label htmlFor="edit-ranked-choice">Ranked Choice</Label>
                            </div>
                          </RadioGroup>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => { setIsEditingConfig(false); setEditConfig(null); }}
                          >
                            Cancel
                          </Button>
                          <Button
                            className="flex-1"
                            disabled={isSavingConfig}
                            onClick={async () => {
                              setIsSavingConfig(true);
                              try {
                                await updateSessionConfig(sessionState.code, editConfig);
                                setSessionState((prev) => ({ ...prev, config: { ...prev.config, ...editConfig } }));
                                setIsEditingConfig(false);
                                setEditConfig(null);
                                toast.success("Session options updated");
                              } catch {
                                toast.error("Failed to update session options");
                              }
                              setIsSavingConfig(false);
                            }}
                          >
                            {isSavingConfig ? <Spinner className="size-4" /> : "Save"}
                          </Button>
                        </div>
                      </div>
                    )}
                    <hr />
                    <div className="flex gap-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="flex-1">
                          {sessionState.myName === sessionState.host ? "End Session" : "Leave Session"}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {sessionState.myName === sessionState.host ? "End Session?" : "Leave Session?"}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {sessionState.myName === sessionState.host
                              ? "Are you sure you want to end this session? This will end the session for all users."
                              : "Are you sure you want to leave this session? You won\u0027t be able to rejoin."}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            disabled={isLeavingSession}
                            onClick={async () => {
                              setIsLeavingSession(true);
                              try {
                                if (sessionState.myName === sessionState.host) {
                                  await closeSession(sessionState.code, sessionState.myName);
                                  disconnect();
                                  setIsRedirecting(true);
                                  localStorage.removeItem(SESSION_KEY);
                                  router.push("/");
                                } else {
                                  await leaveSession(sessionState.code, sessionState.myName);
                                  localStorage.removeItem(SESSION_KEY);
                                  router.push("/");
                                }
                              } catch {
                                setIsLeavingSession(false);
                                toast.error(
                                  sessionState.myName === sessionState.host
                                    ? "Failed to end session"
                                    : "Failed to leave session"
                                );
                              }
                            }}
                          >
                            {isLeavingSession ? <Spinner className="size-4" /> : (sessionState.myName === sessionState.host ? "End" : "Leave")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <DialogClose asChild>
                      <Button variant="outline" className="flex-1">Close</Button>
                    </DialogClose>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardTitle>
            <CardDescription className="text-lg">
              Join Code: {sessionState.code.toUpperCase()}
              <button
                className="inline-block ml-1 align-middle cursor-pointer opacity-60 hover:opacity-100 transition-opacity"
                onClick={() => {
                  navigator.clipboard.writeText(sessionState.code.toUpperCase());
                  toast("Join code copied to clipboard!");
                }}
                aria-label="Copy join code"
              >
                <Image src="/copy.svg" alt="Copy" title="Copy Join Code" width={16} height={16} />
              </button>
            </CardDescription>
            <CardAction>
              <div className="flex flex-col items-end gap-2">
              <UserBadge name={sessionState.myName} />
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
                  <Image src="/share.svg" alt="Share" title="Share Session" width={20} height={20} />
                </Button>
                <Button
                  variant={
                    sessionState.ready[sessionState.myName] ? "outline" : "default"
                  }
                  onClick={() => setReady(!sessionState.ready[sessionState.myName])}
                  disabled={!isConnected}
                >
                  {sessionState.ready[sessionState.myName] ? "I'm Ready!" : "Ready?"}
                </Button>
              </div>
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
            <CardAction><UserBadge name={sessionState.myName} /></CardAction>
          </CardHeader>
          <CardContent>
            <p className="mb-2">Add your suggestions for <b>{sessionState.title}</b></p>
            <p className="text-sm text-muted-foreground mb-4">
              {sessionState.config.min_choices > 0 && sessionState.config.max_choices > 0 && (
                <>Required: {sessionState.config.min_choices} - {sessionState.config.max_choices} options</>
              )}
              {sessionState.config.min_choices > 0 && !sessionState.config.max_choices && (
                <>Minimum: {sessionState.config.min_choices} options</>
              )}
              {!sessionState.config.min_choices && sessionState.config.max_choices > 0 && (
                <>Maximum: {sessionState.config.max_choices} options</>
              )}
            </p>

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
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setEditingListChoiceTitle(choice.title);
                          setEditingListChoiceValue(choice.title);
                        }}
                        className="cursor-pointer text-muted-foreground hover:text-foreground p-1"
                        aria-label={`Edit ${choice.title}`}
                      >
                        <Image src="/edit.svg" alt="Edit" width={20} height={20} className="opacity-70 hover:opacity-100 transition-opacity" />
                      </button>
                      <button
                        onClick={() => handleRemoveChoice(choice.title)}
                        className="cursor-pointer text-muted-foreground hover:text-destructive p-1"
                        aria-label={`Remove ${choice.title}`}
                      >
                        <Image src="/trash-xmark.svg" alt="Remove" width={20} height={20} className="opacity-70 hover:opacity-100 transition-opacity" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {choices.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-4">
                No options added yet. Add your first option above!
              </p>
            )}

            {/* Validation warning */}
            {choices.length > 0 && (
              choices.length < sessionState.config.min_choices ? (
                <p className="text-amber-600 text-sm mb-4">
                  You need at least {sessionState.config.min_choices} option{sessionState.config.min_choices !== 1 ? "s" : ""} to submit. Add {sessionState.config.min_choices - choices.length} more.
                </p>
              ) : choices.length > sessionState.config.max_choices ? (
                <p className="text-amber-600 text-sm mb-4">
                  You have too many options. Remove {choices.length - sessionState.config.max_choices} to submit.
                </p>
              ) : null
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
                    <Button
                      size="lg"
                      className="w-40"
                      disabled={
                        choices.length < sessionState.config.min_choices ||
                        choices.length > sessionState.config.max_choices
                      }
                    >
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
                        onClick={() => {
                          submitChoices();
                          setSessionState((prev) => ({
                            ...prev,
                            phase: "submitted",
                            submitted: { ...prev.submitted, [prev.myName]: true },
                          }));
                        }}
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
            <CardDescription>List Submitted</CardDescription>
            <CardAction><UserBadge name={sessionState.myName} /></CardAction>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Spinner className="size-4" />
              <span>
                Waiting for {membersWhoHaventSubmitted.length} member
                {membersWhoHaventSubmitted.length !== 1 ? "s" : ""} to submit their list
              </span>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {sessionState.members.map((m) => (
                <li key={m} className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      sessionState.submitted[m] ? "bg-green-500" : "bg-gray-300"
                    }`}
                  />
                  <span className="text-muted-foreground">
                    {m}
                    {m === sessionState.myName && " (you)"}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Yes/No voting: carousel + review */}
      {sessionState.active && sessionState.phase === "results" && !isRankedChoice && !inVoteReview && (
        <Card className="w-full max-w-sm m-10">
          <CardHeader>
            <CardTitle className="text-2xl">{sessionState.title}</CardTitle>
            <CardDescription>
              {allChoices.length === 0 ? "Loading..." : choicesRemaining > 0 ? `Vote · ${choicesRemaining} choice${choicesRemaining !== 1 ? "s" : ""} remaining` : "Vote · All voted!"}
            </CardDescription>
            <CardAction><UserBadge name={sessionState.myName} /></CardAction>
          </CardHeader>
          <CardContent>
            {allChoices.length === 0 && (
              <div className="flex justify-center py-8">
                <Spinner className="size-6" />
              </div>
            )}
            {allChoices.length > 0 && (
            <div className="flex flex-col items-center gap-6">
              <p className="text-xl font-semibold text-center px-4">
                {allChoices[currentChoiceIndex]?.title}
              </p>
              {localVotes[allChoices[currentChoiceIndex]?.title] !== undefined && (
                <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                  localVotes[allChoices[currentChoiceIndex]?.title] === 1
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}>
                  {localVotes[allChoices[currentChoiceIndex]?.title] === 1 ? "Yes" : "No"}
                </span>
              )}
              <div className="flex gap-4">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-24 border-red-300 text-red-600 hover:bg-red-50"
                  onClick={() => {
                    setLocalVotes((prev) => ({ ...prev, [allChoices[currentChoiceIndex].title]: 0 }));
                    if (currentChoiceIndex === allChoices.length - 1) {
                      setInVoteReview(true);
                    } else {
                      setCurrentChoiceIndex((i) => i + 1);
                    }
                  }}
                >
                  <Image src="/thumbs-down.svg" alt="No" width={24} height={24} />
                </Button>
                <Button
                  size="lg"
                  className="w-24 bg-green-600 hover:bg-green-700"
                  onClick={() => {
                    setLocalVotes((prev) => ({ ...prev, [allChoices[currentChoiceIndex].title]: 1 }));
                    if (currentChoiceIndex === allChoices.length - 1) {
                      setInVoteReview(true);
                    } else {
                      setCurrentChoiceIndex((i) => i + 1);
                    }
                  }}
                >
                  <Image src="/thumbs-up.svg" alt="Thumbs Up" loading="eager" width={24} height={24} />
                </Button>
              </div>
              <div className="flex items-center gap-6">
                <Button
                  variant="ghost"
                  size="icon"
                  className={currentChoiceIndex === 0 ? "invisible" : ""}
                  onClick={() => setCurrentChoiceIndex((i) => i - 1)}
                >
                  <Image src="/arrow-small-left.svg" alt="Previous" loading="eager" width={20} height={20} />
                </Button>
                <span className="text-sm text-muted-foreground">
                  {currentChoiceIndex + 1} / {allChoices.length}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className={currentChoiceIndex === allChoices.length - 1 ? "invisible" : ""}
                  onClick={() => setCurrentChoiceIndex((i) => i + 1)}
                >
                  <Image src="/arrow-small-right.svg" alt="Next" loading="eager" width={20} height={20} />
                </Button>
              </div>
              {currentChoiceIndex === allChoices.length - 1 && (
                <Button className="w-full" onClick={() => setInVoteReview(true)}>
                  Review Votes
                </Button>
              )}
            </div>
            )}
          </CardContent>
        </Card>
      )}

      {sessionState.active && sessionState.phase === "results" && !isRankedChoice && inVoteReview && (
        <Card className="w-full max-w-sm m-10">
          <CardHeader>
            <CardTitle className="text-2xl">{sessionState.title}</CardTitle>
            <CardDescription>Review your votes</CardDescription>
            <CardAction><UserBadge name={sessionState.myName} /></CardAction>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 mb-6">
              {allChoices.map((choice) => (
                <li
                  key={choice.title}
                  className="flex items-center justify-between py-2 px-4 rounded-md bg-muted cursor-pointer hover:bg-muted/80"
                  onClick={() => setEditingChoiceTitle(choice.title)}
                >
                  <span>
                    {choice.title}
                    {localVotes[choice.title] === undefined && <span className="text-red-500 ml-1">*</span>}
                  </span>
                  <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
                    localVotes[choice.title] === 1
                      ? "bg-green-100 text-green-700"
                      : localVotes[choice.title] === 0
                      ? "bg-red-100 text-red-700"
                      : "bg-gray-100 text-gray-500"
                  }`}>
                    {localVotes[choice.title] === 1
                      ? <Image src="/thumbs-up.svg" alt="Thumbs Up" loading="eager" width={16} height={16} />
                      : localVotes[choice.title] === 0
                      ? <Image src="/thumbs-down.svg" alt="Thumbs Down" loading="eager" width={16} height={16} />
                      : "—"}
                  </span>
                </li>
              ))}
            </ul>
            {choicesRemaining > 0 && (
              <p className="text-amber-600 text-sm mb-4">
                {choicesRemaining} choice{choicesRemaining !== 1 ? "s" : ""} still need{choicesRemaining === 1 ? "s" : ""} a vote.
              </p>
            )}
            <div className="flex justify-between items-center">
              <Button variant="ghost" onClick={() => setInVoteReview(false)}>
                ‹ Back
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="lg" className="w-40" disabled={choicesRemaining > 0}>
                    Submit Votes
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Submit your votes?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You won&apos;t be able to change your votes after submitting.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSubmitVotes}>
                      Submit
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ranked choice voting: sortable list */}
      {sessionState.active && sessionState.phase === "results" && isRankedChoice && (
        <Card className="w-full max-w-sm m-10">
          <CardHeader>
            <CardTitle className="text-2xl">{sessionState.title}</CardTitle>
            <CardDescription>
              {allChoices.length === 0 ? "Loading..." : "Rank your choices — drag or enter a number"}
            </CardDescription>
            <CardAction><UserBadge name={sessionState.myName} /></CardAction>
          </CardHeader>
          <CardContent>
            {allChoices.length === 0 && (
              <div className="flex justify-center py-8">
                <Spinner className="size-6" />
              </div>
            )}
            {rankedOrder.length > 0 && (
              <>
                <DndContext
                  id={dndId}
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={rankedOrder} strategy={verticalListSortingStrategy}>
                    <ul className="space-y-2 mb-6">
                      {rankedOrder.map((title, index) => (
                        <SortableChoiceItem
                          key={title}
                          id={title}
                          title={title}
                          rank={index + 1}
                          totalChoices={rankedOrder.length}
                          onRankChange={(newRank) => handleRankInputChange(title, newRank)}
                        />
                      ))}
                    </ul>
                  </SortableContext>
                </DndContext>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="lg" className="w-full">
                      Submit Ranking
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Submit your ranking?</AlertDialogTitle>
                      <AlertDialogDescription>
                        You won&apos;t be able to change your ranking after submitting.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleSubmitVotes}>
                        Submit
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {editingChoiceTitle !== null && (
        <AlertDialog open onOpenChange={(open) => { if (!open) setEditingChoiceTitle(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{editingChoiceTitle}</AlertDialogTitle>
              <AlertDialogDescription>Change your vote for this choice.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setEditingChoiceTitle(null)}>Cancel</AlertDialogCancel>
              <Button
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50"
                onClick={() => {
                  setLocalVotes((prev) => ({ ...prev, [editingChoiceTitle]: 0 }));
                  setEditingChoiceTitle(null);
                }}
              >
                <Image src="/thumbs-down.svg" alt="Thumbs Down" loading="eager" width={20} height={20} />
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={() => {
                  setLocalVotes((prev) => ({ ...prev, [editingChoiceTitle]: 1 }));
                  setEditingChoiceTitle(null);
                }}
              >
                <Image src="/thumbs-up.svg" alt="Thumbs Up" loading="eager" width={20} height={20} />
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {editingListChoiceTitle !== null && (
        <AlertDialog open onOpenChange={(open) => { if (!open) setEditingListChoiceTitle(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Edit choice</AlertDialogTitle>
            </AlertDialogHeader>
            <Input
              value={editingListChoiceValue}
              onChange={(e) => setEditingListChoiceValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleEditChoice(editingListChoiceTitle, editingListChoiceValue);
                  setEditingListChoiceTitle(null);
                }
              }}
              autoFocus
            />
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setEditingListChoiceTitle(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={!editingListChoiceValue.trim()}
                onClick={() => {
                  handleEditChoice(editingListChoiceTitle, editingListChoiceValue);
                  setEditingListChoiceTitle(null);
                }}
              >
                Save
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {sessionState.active && sessionState.phase === "submitted_votes" && (
        <Card className="w-full max-w-sm m-10">
          <CardHeader>
            <CardTitle className="text-2xl">{sessionState.title}</CardTitle>
            <CardDescription>Votes Submitted</CardDescription>
            <CardAction><UserBadge name={sessionState.myName} /></CardAction>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Spinner className="size-4" />
              <span>
                Waiting for {membersWhoHaventVoted.length} member
                {membersWhoHaventVoted.length !== 1 ? "s" : ""} to submit their votes
              </span>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {sessionState.members.map((m) => (
                <li key={m} className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      sessionState.voted[m] ? "bg-green-500" : "bg-gray-300"
                    }`}
                  />
                  <span className="text-muted-foreground">
                    {m}
                    {m === sessionState.myName && " (you)"}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Dialog open={isRedirecting || closedCountdown !== null}>
        <DialogContent showCloseButton={false}>
          <DialogTitle className="sr-only">Redirecting</DialogTitle>
          <div className="flex flex-col items-center justify-center gap-3 py-4">
            <svg className="animate-spin h-6 w-6 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm text-muted-foreground">
              {closedCountdown !== null
                ? `Host ended the session. Redirecting in ${closedCountdown}...`
                : "Redirecting..."}
            </p>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
