import { useState, useRef, useEffect } from "react";
import { ref, set, onValue, remove, onDisconnect } from "firebase/database";
import { db } from "./firebase";
import { gameScripts } from "./gameData";
import "./App.css";

import moveSound from "./assets/move.wav";
import popupSound from "./assets/popup.mp3";

function App() {
  const [player, setPlayer] = useState(null);
  const [pendingPlayer, setPendingPlayer] = useState(null);
  const [playerName, setPlayerName] = useState("");

  const [step, setStep] = useState(0);
  const [warning, setWarning] = useState("");
  const [showInstruction, setShowInstruction] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [gameStarted, setGameStarted] = useState(false);
  const [startClicked, setStartClicked] = useState(false);
  const [showNextCell, setShowNextCell] = useState(true);
  const [allPlayers, setAllPlayers] = useState({});

  const instructionTimer = useRef(null);
  const countdownInterval = useRef(null);

  const players = ["W1", "W2", "W3", "B1", "B2", "B3"];

  const warningMessages = [
    "ACCESS DENIED",
    "INVALID MOVEMENT DETECTED",
    "PATH NOT AUTHORIZED",
    "MOVEMENT REJECTED",
    "SECTOR RESTRICTED",
    "OBSERVATION INCREASED",
    "BEHAVIORAL ANOMALY DETECTED",
    "RETURN TO ASSIGNED PATH",
  ];

  useEffect(() => {
    const playersRef = ref(db, "players");

    const unsubscribe = onValue(playersRef, (snapshot) => {
      setAllPlayers(snapshot.val() || {});
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!player) return;

    const playerRef = ref(db, `players/${player}`);
    onDisconnect(playerRef).remove();
  }, [player]);

  function updatePlayerPosition(position) {
    if (!player) return;

    set(ref(db, `players/${player}`), {
      position,
      name: allPlayers[player]?.name || player,
      color: player.startsWith("W") ? "white" : "black",
    });
  }

  function playPopupSound() {
    const audio = new Audio(popupSound);
    audio.volume = 0.35;
    audio.playbackRate = 0.95;
    audio.play();
  }

  function playMoveSound() {
    const audio = new Audio(moveSound);
    audio.volume = 0.3;
    audio.playbackRate = 0.95;
    audio.play();
  }

  function playWarningSound() {
    const audio = new Audio("/wrong-move.wav");
    audio.volume = 0.7;
    audio.play();
  }

  function vibrateWarning() {
    if ("vibrate" in navigator) {
      navigator.vibrate([150, 80, 150]);
    }
  }

  function showWrongMoveWarning() {
    const randomMessage =
      warningMessages[Math.floor(Math.random() * warningMessages.length)];

    setWarning(randomMessage);
    playWarningSound();
    vibrateWarning();

    setTimeout(() => {
      setWarning("");
    }, 2000);
  }

  function closeInstructionPopup() {
    setShowInstruction(false);
    clearTimeout(instructionTimer.current);
    clearInterval(countdownInterval.current);
  }

  function startGame() {
    setGameStarted(true);
    setShowInstruction(false);
  }

  function showInstructionPopup() {
    playPopupSound();
    setShowInstruction(true);
    setCountdown(5);

    clearTimeout(instructionTimer.current);
    clearInterval(countdownInterval.current);

    let seconds = 5;

    countdownInterval.current = setInterval(() => {
      seconds--;
      setCountdown(seconds);

      if (seconds <= 0) {
        clearInterval(countdownInterval.current);
      }
    }, 1000);

    instructionTimer.current = setTimeout(() => {
      closeInstructionPopup();
    }, 5000);
  }

  function revealNextCellWithDelay() {
    setShowNextCell(false);

    setTimeout(() => {
      showInstructionPopup();
    }, 600);

    setTimeout(() => {
      setShowNextCell(true);
    }, 2500);
  }

  function nextStep() {
    const script = gameScripts[player];

    if (step < script.length - 1) {
      playMoveSound();
      setStep(step + 1);
      revealNextCellWithDelay();
    }
  }

  async function resetGame() {
    if (player) {
      await remove(ref(db, `players/${player}`));
    }

    setPlayer(null);
    setStep(0);
    setWarning("");
    setShowInstruction(false);
    setGameStarted(false);
    setStartClicked(false);
    setShowNextCell(true);
    setCountdown(5);

    clearTimeout(instructionTimer.current);
    clearInterval(countdownInterval.current);
  }

  function renderBoard(currentPosition = null, nextPosition = null) {
    return (
      <div className="board-preview">
        {[6, 5, 4, 3, 2, 1].map((row) =>
          ["A", "B", "C"].map((col) => {
            const position = `${col}${row}`;

            return (
              <div
                key={position}
                className={`square ${
                  position === currentPosition ? "active-square" : ""
                } ${position === nextPosition ? "next-square" : ""}`}
                onClick={() => {
                  if (!player || !gameStarted || showInstruction) return;

                  const script = gameScripts[player];
                  const startPosition = script[0].start;

                  if (!startClicked) {
                    if (position === startPosition) {
                      updatePlayerPosition(startPosition);
                      playMoveSound();
                      setStartClicked(true);
                      revealNextCellWithDelay();
                    } else {
                      showWrongMoveWarning();
                    }

                    return;
                  }

                  if (position === currentPosition) return;

                  if (position === nextPosition) {
                    updatePlayerPosition(nextPosition);
                    setWarning("");
                    nextStep();
                  } else {
                    showWrongMoveWarning();
                  }
                }}
              >
                {position}

                <div className="players-on-square">
                  {Object.entries(allPlayers)
                    .filter(([_, data]) => data.position === position)
                    .map(([p, data]) => (
                      <div key={p} className="mini-piece-wrapper">
                        <div
                          className={`mini-piece ${
                            p.startsWith("W") ? "white" : "black"
                          }`}
                        >
                          ♟︎
                        </div>
                        <span className="mini-piece-label">
                          {p}: {data.name || p}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  }

  if (!player) {
    return (
      <div className="container home-screen">
        <h1>ENTER THE BOARD</h1>

        <div className="home-board">{renderBoard()}</div>

        <p className="subtitle">
          Choose your piece and receive your instruction path:
        </p>

        <div className="buttons">
          {players.map((p) => (
            <button
              className="player-button"
              key={p}
              onClick={() => {
                setPendingPlayer(p);
                setPlayerName("");
              }}
            >
              <div
                className={`player-button-content ${
                  p.startsWith("W") ? "white" : "black"
                }`}
              >
                <div
                  className={`button-chess-symbol ${
                    p.startsWith("W") ? "white" : "black"
                  }`}
                >
                  ♟︎
                </div>

                <span>{p}</span>
              </div>
            </button>
          ))}
        </div>

        {pendingPlayer && (
          <>
            <div className="modal-backdrop"></div>

            <div className="instruction-popup">
              <h2>ENTER NAME</h2>

              <input
                className="name-input"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Your name"
              />

              <button
                className="close-popup-btn"
                onClick={() => {
                  setPlayer(pendingPlayer);
                  setStep(0);
                  setWarning("");
                  setGameStarted(false);
                  setStartClicked(false);
                  setShowNextCell(true);

                  set(ref(db, `players/${pendingPlayer}`), {
                    position: null,
                    name: playerName || pendingPlayer,
                    color: pendingPlayer.startsWith("W") ? "white" : "black",
                  });

                  setPendingPlayer(null);
                  playPopupSound();
                  setShowInstruction(true);
                }}
              >
                CONTINUE
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  const script = gameScripts[player];
  const instruction = script[step];
  const startPosition = script[0].start;

  return (
    <div className="container">
      <div className="player-tag">
        {player}: {allPlayers[player]?.name || player}
      </div>

      {renderBoard(
        startClicked ? instruction.current : null,
        showInstruction || !gameStarted || !showNextCell
          ? null
          : startClicked
          ? instruction.next
          : startPosition
      )}

      {gameStarted && startClicked && (
        <button className="instruction-btn" onClick={showInstructionPopup}>
          SHOW INSTRUCTION
        </button>
      )}

      {warning && <div className="warning-message">{warning}</div>}

      {showInstruction && <div className="modal-backdrop"></div>}

      {showInstruction && (
        <div className="instruction-popup">
          {!gameStarted ? (
            <>
              <h2>HOW TO PLAY</h2>
              <p>Click your starting square first.</p>
              <p>Then follow the highlighted movement path.</p>

              <button className="close-popup-btn" onClick={startGame}>
                START
              </button>
            </>
          ) : (
            <>
              <h2>INSTRUCTION</h2>
              <p>{instruction.message}</p>

              <h2>NEXT MOVE</h2>
              <p>{instruction.next}</p>

              <button className="close-popup-btn" onClick={closeInstructionPopup}>
                CONTINUE ({countdown})
              </button>
            </>
          )}
        </div>
      )}

      {step >= script.length - 1 && (
        <>
          <h2>SYSTEM FAILURE</h2>
          <button onClick={resetGame}>START OVER</button>
        </>
      )}
    </div>
  );
}

export default App;