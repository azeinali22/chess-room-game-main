import { useState, useRef, useEffect } from "react";
import {
  ref,
  set,
  update,
  onValue,
  remove,
  onDisconnect,
  runTransaction,
  get,
  push,
  serverTimestamp,
} from "firebase/database";
import { db } from "./firebase";
import { gameScripts } from "./gameData";
import "./App.css";

import moveSound from "./assets/move.wav";
import popupSound from "./assets/popup.mp3";

function App() {
  const [player, setPlayer] = useState(null);
  const [isReferee, setIsReferee] = useState(false);
  const [showRefereeLogin, setShowRefereeLogin] = useState(false);
  const [refereePassword, setRefereePassword] = useState("");
  const [refereePasswordError, setRefereePasswordError] = useState("");

  // Set VITE_REFEREE_PASSWORD in your .env file.
  // The fallback password is only for local testing.
  const REFEREE_PASSWORD =
    import.meta.env.VITE_REFEREE_PASSWORD || "2468";
  const [pendingPlayer, setPendingPlayer] = useState(null);
  const [playerName, setPlayerName] = useState("");
  const [playerSelectionError, setPlayerSelectionError] = useState("");

  const [step, setStep] = useState(0);
  const [warning, setWarning] = useState("");
  const [showInstruction, setShowInstruction] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [gameStarted, setGameStarted] = useState(false);
  const [startClicked, setStartClicked] = useState(false);
  const [showNextCell, setShowNextCell] = useState(true);
  const [allPlayers, setAllPlayers] = useState({});
  const [playersLoaded, setPlayersLoaded] = useState(false);
  const [gameStatus, setGameStatus] = useState("lobby");
  const [activityLog, setActivityLog] = useState([]);
  const [selectedRefereePlayer, setSelectedRefereePlayer] = useState(null);

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
      setPlayersLoaded(true);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const gameStatusRef = ref(db, "game/status");

    const unsubscribe = onValue(gameStatusRef, (snapshot) => {
      setGameStatus(snapshot.val() || "lobby");
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const activityRef = ref(db, "activity");

    const unsubscribe = onValue(activityRef, (snapshot) => {
      const data = snapshot.val() || {};

      const entries = Object.entries(data)
        .map(([id, entry]) => ({ id, ...entry }))
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
        .slice(-50)
        .reverse();

      setActivityLog(entries);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!player || isReferee) return;

    const playerRef = ref(db, `players/${player}`);
    onDisconnect(playerRef).remove();
  }, [player, isReferee]);

  useEffect(() => {
    if (!playersLoaded || !player || isReferee) return;

    if (!allPlayers[player]) {
      setPlayer(null);
      setStep(0);
      setWarning("");
      setShowInstruction(false);
      setGameStarted(false);
      setStartClicked(false);
      setShowNextCell(true);
      setCountdown(5);
    }
  }, [playersLoaded, allPlayers, player, isReferee]);

  useEffect(() => {
    if (!player || isReferee) return;

    if (gameStatus === "playing" && !gameStarted) {
      setGameStarted(true);
      setShowInstruction(true);
    }

    if (gameStatus === "paused") {
      setShowInstruction(false);
    }

    if (gameStatus === "lobby") {
      setGameStarted(false);
      setStartClicked(false);
      setStep(0);
      setShowInstruction(false);
      setShowNextCell(true);
    }
  }, [gameStatus, player, isReferee, gameStarted]);

  function logActivity(type, message, playerId = null) {
    push(ref(db, "activity"), {
      type,
      message,
      playerId,
      timestamp: serverTimestamp(),
    }).catch((error) => {
      console.error("Unable to save activity:", error);
    });
  }

  function updatePlayerStatus(data) {
    if (!player || isReferee) return;
    update(ref(db, `players/${player}`), data);
  }

  function updatePlayerPosition(position, databaseStep = step) {
    if (!player || isReferee) return;

    const previousPosition = allPlayers[player]?.position || "START";

    update(ref(db, `players/${player}`), {
      position,
      step: databaseStep,
      name: allPlayers[player]?.name || player,
      color: player.startsWith("W") ? "white" : "black",
      gameStarted: true,
      startClicked: true,
    });

    logActivity(
      "move",
      `${allPlayers[player]?.name || player} (${player}) moved ${previousPosition} → ${position}`,
      player
    );
  }

  async function claimPlayerSlot(playerId) {
    const playerRef = ref(db, `players/${playerId}`);

    try {
      const statusSnapshot = await get(ref(db, "game/status"));
      const liveGameStatus = statusSnapshot.val() || "lobby";

      if (liveGameStatus !== "lobby") {
        setPlayerSelectionError(
          "The game has already started. Please wait for the referee to reset the lobby."
        );
        setPendingPlayer(null);
        return;
      }

      const result = await runTransaction(playerRef, (currentData) => {
        // Returning undefined cancels the transaction when the slot is occupied.
        if (currentData !== null) {
          return;
        }

        return {
          position: null,
          step: 0,
          name: playerName.trim() || playerId,
          color: playerId.startsWith("W") ? "white" : "black",
          gameStarted: false,
          startClicked: false,
          ready: true,
        };
      });

      if (!result.committed) {
        setPlayerSelectionError(
          `${playerId} was just selected by another player. Please choose another piece.`
        );
        setPendingPlayer(null);
        return;
      }

      setAllPlayers((currentPlayers) => ({
        ...currentPlayers,
        [playerId]: result.snapshot.val(),
      }));
      setPlayer(playerId);
      setStep(0);
      setWarning("");
      setGameStarted(false);
      setStartClicked(false);
      setShowNextCell(true);
      setPlayerSelectionError("");
      setPendingPlayer(null);
      playPopupSound();
      setShowInstruction(true);

      logActivity(
        "join",
        `${playerName.trim() || playerId} joined as ${playerId}`,
        playerId
      );
    } catch (error) {
      console.error("Unable to claim player slot:", error);
      setPlayerSelectionError(
        "Unable to select this player right now. Please try again."
      );
    }
  }

  function playPopupSound() {
    const audio = new Audio(popupSound);
    audio.volume = 0.35;
    audio.playbackRate = 0.95;
    audio.play().catch(() => {});
  }

  function playMoveSound() {
    const audio = new Audio(moveSound);
    audio.volume = 0.3;
    audio.playbackRate = 0.95;
    audio.play().catch(() => {});
  }

  function playWarningSound() {
    const audio = new Audio("/wrong-move.wav");
    audio.volume = 0.7;
    audio.play().catch(() => {});
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

    if (player) {
      logActivity(
        "warning",
        `${allPlayers[player]?.name || player} (${player}) attempted an invalid move`,
        player
      );
    }

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
    setShowInstruction(false);

    updatePlayerStatus({
      gameStarted: true,
      startClicked: false,
      step: 0,
    });
  }

  async function refereeStartGame() {
    const connectedPlayerCount = Object.keys(allPlayers).filter(
      (playerId) => gameScripts[playerId]
    ).length;

    if (connectedPlayerCount === 0) return;

    // Start every game with a clean activity feed.
    await remove(ref(db, "activity"));
    await set(ref(db, "game/status"), "playing");

    logActivity("system", "Referee started the game");
  }

  async function refereePauseGame() {
    await set(ref(db, "game/status"), "paused");
    logActivity("system", "Referee paused the game");
  }

  async function refereeResumeGame() {
    await set(ref(db, "game/status"), "playing");
    logActivity("system", "Referee resumed the game");
  }

  async function refereeRestartGame() {
    const playerIds = Object.keys(allPlayers).filter(
      (playerId) => gameScripts[playerId]
    );

    const updates = {};

    playerIds.forEach((playerId) => {
      updates[`players/${playerId}/position`] = null;
      updates[`players/${playerId}/step`] = 0;
      updates[`players/${playerId}/gameStarted`] = false;
      updates[`players/${playerId}/startClicked`] = false;
      updates[`players/${playerId}/ready`] = true;
    });

    updates["game/status"] = "lobby";

    await update(ref(db), updates);
    setSelectedRefereePlayer(null);
    logActivity("system", "Referee restarted the game and returned players to the lobby");
  }

  async function refereeClearLobby() {
    await set(ref(db, "game/status"), "lobby");
    await remove(ref(db, "players"));
    setSelectedRefereePlayer(null);
    logActivity("system", "Referee cleared the lobby");
  }

  async function refereeEndGame() {
    await set(ref(db, "game/status"), "lobby");
    await remove(ref(db, "players"));
    setSelectedRefereePlayer(null);
    logActivity("system", "Referee ended the game");
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
      setStep((currentStep) => currentStep + 1);
      revealNextCellWithDelay();
    }
  }

  async function resetGame() {
    if (player) {
      logActivity(
        "leave",
        `${allPlayers[player]?.name || player} (${player}) left the game`,
        player
      );
      await remove(ref(db, `players/${player}`));
    }

    setPlayer(null);
    setIsReferee(false);
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

  function openRefereeLogin() {
    setRefereePassword("");
    setRefereePasswordError("");
    setShowRefereeLogin(true);
  }

  function closeRefereeLogin() {
    setShowRefereeLogin(false);
    setRefereePassword("");
    setRefereePasswordError("");
  }

  function submitRefereePassword() {
    if (refereePassword === REFEREE_PASSWORD) {
      setIsReferee(true);
      closeRefereeLogin();
      return;
    }

    setRefereePasswordError("Incorrect password");
    setRefereePassword("");
  }

  function leaveRefereeMode() {
    setIsReferee(false);
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
                  if (
                    isReferee ||
                    !player ||
                    !gameStarted ||
                    gameStatus !== "playing" ||
                    showInstruction
                  ) {
                    return;
                  }

                  const script = gameScripts[player];
                  const startPosition = script[0].start;

                  if (!startClicked) {
                    if (position === startPosition) {
                      updatePlayerPosition(startPosition, 0);
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
                    const nextDatabaseStep = Math.min(
                      step + 1,
                      script.length - 1
                    );

                    updatePlayerPosition(nextPosition, nextDatabaseStep);
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

  function renderRefereeCard(playerId, data) {
    const script = gameScripts[playerId];
    const safeStep = Math.min(
      Number.isInteger(data.step) ? data.step : 0,
      script.length - 1
    );
    const card = script[safeStep];
    const hasStarted = Boolean(data.startClicked);
    const isFinished = safeStep >= script.length - 1;
    const isWaitingInLobby = gameStatus === "lobby";

    const progressPercent = Math.round(
      ((safeStep + 1) / script.length) * 100
    );
    const isSelected = selectedRefereePlayer === playerId;

    return (
      <article
        className={`referee-card ${isSelected ? "selected" : ""}`}
        key={playerId}
        onClick={() =>
          setSelectedRefereePlayer(isSelected ? null : playerId)
        }
      >
        <div className="referee-card-header">
          <div
            className={`referee-piece ${
              playerId.startsWith("W") ? "white" : "black"
            }`}
          >
            ♟︎
          </div>

          <div>
            <h3>{playerId}</h3>
            <p>{data.name || playerId}</p>
          </div>

          <span
            className={`player-status ${
              isFinished
                ? "finished"
                : hasStarted
                ? "playing"
                : "waiting"
            }`}
          >
            {isWaitingInLobby
              ? "READY"
              : gameStatus === "paused"
              ? "PAUSED"
              : isFinished
              ? "FINISHED"
              : hasStarted
              ? "PLAYING"
              : "WAITING"}
          </span>
        </div>

        <div className="referee-progress">
          <div className="referee-progress-label">
            <span>PROGRESS</span>
            <strong>{progressPercent}%</strong>
          </div>
          <div className="referee-progress-track">
            <div
              className="referee-progress-fill"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>

        <div className="referee-card-details">
          <p>
            <strong>Current square:</strong>{" "}
            {data.position || "Not placed"}
          </p>
          <p>
            <strong>Card number:</strong> {safeStep + 1} / {script.length}
          </p>
          <p>
            <strong>Instruction:</strong> {card.message}
          </p>
          <p>
            <strong>Next move:</strong>{" "}
            {isFinished ? "Game completed" : card.next}
          </p>
        </div>
      </article>
    );
  }

  if (player && gameStatus === "paused" && !isReferee) {
    return (
      <div className="container paused-game-screen">
        <div className="pause-icon">Ⅱ</div>
        <h1>GAME PAUSED</h1>
        <div className="lobby-player-name">
          {player}: {allPlayers[player]?.name || player}
        </div>
        <p className="subtitle">
          The referee has paused the game. Please stay on this screen.
        </p>
        <div className="waiting-indicator">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    );
  }

  if (player && gameStatus === "lobby" && !isReferee) {
    return (
      <div className="container player-lobby-screen">
        <div className="lobby-piece">
          <div
            className={`button-chess-symbol ${
              player.startsWith("W") ? "white" : "black"
            }`}
          >
            ♟︎
          </div>
        </div>

        <h1>WAITING ROOM</h1>

        <div className="lobby-player-name">
          {player}: {allPlayers[player]?.name || player}
        </div>

        <p className="subtitle">
          You are ready. The game will begin when the referee starts it.
        </p>

        <div className="waiting-indicator">
          <span></span>
          <span></span>
          <span></span>
        </div>

        <div className="lobby-ready-count">
          {Object.keys(allPlayers).filter((playerId) => gameScripts[playerId]).length}
          /6 PLAYERS READY
        </div>

        <button className="leave-lobby-btn" onClick={resetGame}>
          LEAVE LOBBY
        </button>
      </div>
    );
  }

  if (isReferee) {
    const connectedPlayers = Object.entries(allPlayers).filter(
      ([playerId]) => gameScripts[playerId]
    );

    const selectedPlayerData = selectedRefereePlayer
      ? allPlayers[selectedRefereePlayer]
      : null;
    const selectedPlayerScript = selectedRefereePlayer
      ? gameScripts[selectedRefereePlayer]
      : null;
    const selectedPlayerStep =
      selectedPlayerData && selectedPlayerScript
        ? Math.min(
            Number.isInteger(selectedPlayerData.step)
              ? selectedPlayerData.step
              : 0,
            selectedPlayerScript.length - 1
          )
        : 0;
    const selectedPlayerCard =
      selectedPlayerScript?.[selectedPlayerStep] || null;

    return (
      <div className="container referee-screen">
        <div className="referee-topbar">
          <div>
            <h1>REFEREE VIEW</h1>
            <p className="subtitle">
              Live board, player positions, and instruction cards
            </p>
          </div>

          <button className="exit-referee-btn" onClick={leaveRefereeMode}>
            EXIT
          </button>
        </div>

        {selectedRefereePlayer && selectedPlayerCard && (
          <div className="follow-player-banner">
            <span>
              FOLLOWING: <strong>{selectedRefereePlayer}</strong> —{" "}
              {selectedPlayerData?.name || selectedRefereePlayer}
            </span>
            <button onClick={() => setSelectedRefereePlayer(null)}>
              STOP FOLLOWING
            </button>
          </div>
        )}

        <div className="referee-board">
          {renderBoard(
            selectedPlayerData?.position || null,
            gameStatus === "playing" ? selectedPlayerCard?.next || null : null
          )}
        </div>

        <section className="referee-stats">
          <div>
            <span>STATUS</span>
            <strong>{gameStatus.toUpperCase()}</strong>
          </div>
          <div>
            <span>PLAYERS</span>
            <strong>{connectedPlayers.length}/6</strong>
          </div>
          <div>
            <span>ACTIVE</span>
            <strong>
              {
                connectedPlayers.filter(
                  ([_, data]) => data.startClicked
                ).length
              }
            </strong>
          </div>
          <div>
            <span>FINISHED</span>
            <strong>
              {
                connectedPlayers.filter(([playerId, data]) => {
                  const script = gameScripts[playerId];
                  const playerStep = Number.isInteger(data.step)
                    ? data.step
                    : 0;
                  return playerStep >= script.length - 1;
                }).length
              }
            </strong>
          </div>
        </section>

        <section className="referee-lobby-controls">
          <div className="referee-game-status">
            GAME STATUS: <strong>{gameStatus.toUpperCase()}</strong>
          </div>

          <div className="referee-lobby-grid">
            {players.map((playerId) => {
              const data = allPlayers[playerId];
              const isReady = Boolean(data);

              return (
                <div
                  className={`lobby-slot ${isReady ? "ready" : "empty"}`}
                  key={playerId}
                >
                  <div
                    className={`lobby-slot-piece ${
                      playerId.startsWith("W") ? "white" : "black"
                    }`}
                  >
                    ♟︎
                  </div>

                  <strong>{playerId}</strong>
                  <span>{isReady ? data.name || playerId : "EMPTY"}</span>
                  <small>{isReady ? "READY" : "WAITING"}</small>
                </div>
              );
            })}
          </div>

          <div className="referee-lobby-actions">
            {gameStatus === "lobby" && (
              <>
                <button
                  className="referee-start-game-btn"
                  onClick={refereeStartGame}
                  disabled={connectedPlayers.length === 0}
                >
                  START GAME ({connectedPlayers.length}/6)
                </button>

                <button
                  className="referee-clear-lobby-btn"
                  onClick={refereeClearLobby}
                  disabled={connectedPlayers.length === 0}
                >
                  CLEAR LOBBY
                </button>
              </>
            )}

            {gameStatus === "playing" && (
              <>
                <button
                  className="referee-pause-game-btn"
                  onClick={refereePauseGame}
                >
                  PAUSE GAME
                </button>

                <button
                  className="referee-end-game-btn"
                  onClick={refereeEndGame}
                >
                  END GAME
                </button>
              </>
            )}

            {gameStatus === "paused" && (
              <>
                <button
                  className="referee-resume-game-btn"
                  onClick={refereeResumeGame}
                >
                  RESUME GAME
                </button>

                <button
                  className="referee-restart-game-btn"
                  onClick={refereeRestartGame}
                >
                  RESTART GAME
                </button>

                <button
                  className="referee-end-game-btn"
                  onClick={refereeEndGame}
                >
                  END GAME
                </button>
              </>
            )}
          </div>
        </section>

        <section className="referee-panel">
          <h2>PLAYER CARDS ({connectedPlayers.length}/6)</h2>
          <p className="referee-panel-hint">
            Click a player card to highlight their current and next square.
          </p>

          {connectedPlayers.length === 0 ? (
            <div className="empty-referee-message">
              No players are currently connected.
            </div>
          ) : (
            <div className="referee-cards">
              {connectedPlayers.map(([playerId, data]) =>
                renderRefereeCard(playerId, data)
              )}
            </div>
          )}
        </section>

        <section className="activity-panel">
          <div className="activity-panel-header">
            <h2>LIVE ACTIVITY</h2>
            <span>{activityLog.length} EVENTS</span>
          </div>

          {activityLog.length === 0 ? (
            <div className="empty-referee-message">
              No activity has been recorded yet.
            </div>
          ) : (
            <div className="activity-list">
              {activityLog.map((entry) => (
                <div
                  className={`activity-item ${entry.type || "system"}`}
                  key={entry.id}
                >
                  <span className="activity-time">
                    {entry.timestamp
                      ? new Date(entry.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })
                      : "--:--:--"}
                  </span>
                  <span className="activity-message">{entry.message}</span>
                </div>
              ))}
            </div>
          )}
        </section>
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

        {gameStatus !== "lobby" && (
          <div className="game-in-progress-message">
            <strong>GAME IN PROGRESS</strong>
            <span>
              New players cannot join until the referee resets the lobby.
            </span>
          </div>
        )}

        <div className="buttons">
          {players.map((p) => {
            const isTaken = Boolean(allPlayers[p]);
            const joiningLocked = gameStatus !== "lobby";

            return (
            <button
              className={`player-button ${
                isTaken ? "player-taken" : ""
              } ${joiningLocked ? "joining-locked" : ""}`}
              key={p}
              disabled={isTaken || joiningLocked}
              onClick={() => {
                if (isTaken || joiningLocked) return;

                setPendingPlayer(p);
                setPlayerName("");
                setPlayerSelectionError("");
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

              {isTaken && <span className="taken-label">TAKEN</span>}
            </button>
            );
          })}
        </div>

        {playerSelectionError && (
          <div className="player-selection-error">
            {playerSelectionError}
          </div>
        )}

        <button
          className="referee-entry-btn"
          onClick={openRefereeLogin}
        >
          ENTER AS REFEREE
        </button>

        {showRefereeLogin && (
          <>
            <div
              className="modal-backdrop"
              onClick={closeRefereeLogin}
            ></div>

            <div className="instruction-popup referee-login-popup">
              <h2>REFEREE ACCESS</h2>
              <p>Enter the referee password.</p>

              <input
                className="name-input"
                type="password"
                value={refereePassword}
                onChange={(e) => {
                  setRefereePassword(e.target.value);
                  setRefereePasswordError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    submitRefereePassword();
                  }
                }}
                placeholder="Password"
                autoFocus
              />

              {refereePasswordError && (
                <div className="referee-password-error">
                  {refereePasswordError}
                </div>
              )}

              <div className="referee-login-actions">
                <button
                  className="referee-cancel-btn"
                  onClick={closeRefereeLogin}
                >
                  CANCEL
                </button>

                <button
                  className="close-popup-btn"
                  onClick={submitRefereePassword}
                >
                  ENTER
                </button>
              </div>
            </div>
          </>
        )}

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
                onClick={() => claimPlayerSlot(pendingPlayer)}
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
                ENTER BOARD
              </button>
            </>
          ) : (
            <>
              <h2>INSTRUCTION</h2>
              <p>{instruction.message}</p>

              <h2>NEXT MOVE</h2>
              <p>{instruction.next}</p>

              <button
                className="close-popup-btn"
                onClick={closeInstructionPopup}
              >
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
