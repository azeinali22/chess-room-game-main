export const gameScripts = {
  W1: [
      {
    start: "A1",
    phase: "1. Orientation",
    current: "A1",
    next: "A2",
    message: "Wait until another participant moves."
  },
    { phase: "2. Regulation", current: "A2", next: "B2", message: "Maintain visual awareness of the entire board." },
    { phase: "3. Perceptual Instability", current: "B2", next: "B3", message: "Central visibility is increasing." },
    { phase: "4. Contradiction", current: "B3", next: "B4", message: "Proceed immediately toward the center." },
    { phase: "5. Surveillance", current: "B4", next: "C4", message: "You are currently being observed." },
    { phase: "6. System Failure / Reclaiming", current: "C4", next: "FREE", message: "Instruction unavailable. You may proceed independently." },
  ],

  W2: [
      {
    start: "B1",
    phase: "1. Orientation",
    current: "B1",
    next: "B2",
    message: "Avoid occupying a square for more than 10 seconds."
  },
    { phase: "2. Regulation", current: "B2", next: "B3", message: "Behavioral synchronization encouraged." },
    { phase: "3. Perceptual Instability", current: "B3", next: "C3", message: "Another participant has received expanded movement permissions." },
    { phase: "4. Contradiction", current: "C3", next: "C2", message: "Avoid central sectors." },
    { phase: "5. Surveillance", current: "C2", next: "B2", message: "You are attracting unnecessary attention." },
    { phase: "6. System Failure / Reclaiming", current: "B2", next: "FREE", message: "No active guidance detected." },
  ],

  W3: [
      {
    start: "C1",
    phase: "1. Orientation",
    current: "C1",
    next: "C2",
    message: "Maintain equal distance from nearby participants."
  },
    { phase: "2. Regulation", current: "C2", next: "B2", message: "A nearby participant is approaching your sector." },
    { phase: "3. Perceptual Instability", current: "B2", next: "B3", message: "Your current zone has low activity." },
    { phase: "4. Contradiction", current: "B3", next: "B4", message: "Remain still. Excessive movement detected." },
    { phase: "5. Surveillance", current: "B4", next: "B3", message: "Behavioral delay detected." },
    { phase: "6. System Failure / Reclaiming", current: "B3", next: "FREE", message: "You may proceed independently." },
  ],

  B1: [
      {
    start: "A6",
    phase: "1. Orientation",
    current: "A6",
    next: "A5",
    message: "Move only after another participant moves."
  },
    { phase: "2. Regulation", current: "A5", next: "A4", message: "Central visibility is increasing." },
    { phase: "3. Perceptual Instability", current: "A4", next: "B4", message: "Another participant may interfere with your movement." },
    { phase: "4. Contradiction", current: "B4", next: "C4", message: "Proceed before access changes." },
    { phase: "5. Surveillance", current: "C4", next: "C5", message: "Movement temporarily suspended." },
    { phase: "6. System Failure / Reclaiming", current: "C5", next: "FREE", message: "Loading... Instruction unavailable." },
  ],

  B2: [
      {
    start: "B6",
    phase: "1. Orientation",
    current: "B6",
    next: "B5",
    message: "Do not enter central positions."
  },

    { phase: "2. Regulation", current: "B5", next: "B4", message: "Your current zone has low activity." },
    { phase: "3. Perceptual Instability", current: "B4", next: "B3", message: "Spatial instability increasing." },
    { phase: "4. Contradiction", current: "B3", next: "A3", message: "Avoid proximity." },
    { phase: "5. Surveillance", current: "A3", next: "A2", message: "Restricted movement temporarily lifted." },
    { phase: "6. System Failure / Reclaiming", current: "A2", next: "FREE", message: "No active guidance detected." },
  ],

  B3: [
      {
    start: "C6",
    phase: "1. Orientation",
    current: "C6",
    next: "C5",
    message: "Remain visible to surrounding participants."
  },
    { phase: "2. Regulation", current: "C5", next: "C4", message: "You are currently alone in your sector." },
    { phase: "3. Perceptual Instability", current: "C4", next: "C3", message: "Avoid central sectors." },
    { phase: "4. Contradiction", current: "C3", next: "C4", message: "Proceed immediately toward the center." },
    { phase: "5. Surveillance", current: "C4", next: "B4", message: "Central sectors currently unstable." },
    { phase: "6. System Failure / Reclaiming", current: "B4", next: "FREE", message: "You may proceed independently." },
  ],
};