"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Coordinate = {
  x: number;
  y: number;
};

type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";

type GameState = "idle" | "running" | "paused" | "over";

const BOARD_SIZE = 20;
const TICK_BASE = 160;
const SPEED_STEP = 6;

const INITIAL_SNAKE: Coordinate[] = [
  { x: 9, y: 10 },
  { x: 8, y: 10 },
  { x: 7, y: 10 }
];

function randomFoodPosition(forbidden: Coordinate[]): Coordinate {
  const taken = new Set(forbidden.map((seg) => `${seg.x}-${seg.y}`));
  let x: number;
  let y: number;
  do {
    x = Math.floor(Math.random() * BOARD_SIZE);
    y = Math.floor(Math.random() * BOARD_SIZE);
  } while (taken.has(`${x}-${y}`));
  return { x, y };
}

function getNextHead(head: Coordinate, direction: Direction): Coordinate {
  switch (direction) {
    case "UP":
      return { x: head.x, y: head.y - 1 };
    case "DOWN":
      return { x: head.x, y: head.y + 1 };
    case "LEFT":
      return { x: head.x - 1, y: head.y };
    case "RIGHT":
      return { x: head.x + 1, y: head.y };
  }
}

function isOppositeDirection(current: Direction, next: Direction): boolean {
  return (
    (current === "UP" && next === "DOWN") ||
    (current === "DOWN" && next === "UP") ||
    (current === "LEFT" && next === "RIGHT") ||
    (current === "RIGHT" && next === "LEFT")
  );
}

function useHighScore(initial = 0): [number, (score: number) => void] {
  const [highScore, setHighScore] = useState<number>(() => {
    if (typeof window === "undefined") return initial;
    const stored = window.localStorage.getItem("snake-high-score");
    return stored ? Number.parseInt(stored, 10) : initial;
  });

  const update = useCallback((score: number) => {
    setHighScore((prev) => {
      if (score > prev) {
        if (typeof window !== "undefined") {
          window.localStorage.setItem("snake-high-score", String(score));
        }
        return score;
      }
      return prev;
    });
  }, []);

  return [highScore, update];
}

export default function HomePage() {
  const [snake, setSnake] = useState<Coordinate[]>(INITIAL_SNAKE);
  const [food, setFood] = useState<Coordinate>(() => randomFoodPosition(INITIAL_SNAKE));
  const [direction, setDirection] = useState<Direction>("RIGHT");
  const [queuedDirection, setQueuedDirection] = useState<Direction>("RIGHT");
  const [gameState, setGameState] = useState<GameState>("idle");
  const [score, setScore] = useState(0);
  const [highScore, updateHighScore] = useHighScore(0);
  const [speedLevel, setSpeedLevel] = useState(0);

  const loopRef = useRef<NodeJS.Timeout | null>(null);
  const directionRef = useRef(direction);
  const queuedRef = useRef(queuedDirection);
  const gameStateRef = useRef(gameState);
  const scoreRef = useRef(score);

  const tickRate = useMemo(() => Math.max(60, TICK_BASE - speedLevel * SPEED_STEP), [speedLevel]);

  const resetGame = useCallback(() => {
    setSnake(INITIAL_SNAKE);
    const newFood = randomFoodPosition(INITIAL_SNAKE);
    setFood(newFood);
    setDirection("RIGHT");
    setQueuedDirection("RIGHT");
    directionRef.current = "RIGHT";
    queuedRef.current = "RIGHT";
    scoreRef.current = 0;
    setScore(0);
    setSpeedLevel(0);
    setGameState("running");
  }, []);

  const stopLoop = useCallback(() => {
    if (loopRef.current) {
      clearInterval(loopRef.current);
    }
    loopRef.current = null;
  }, []);

  const startLoop = useCallback(() => {
    stopLoop();
    loopRef.current = setInterval(() => {
      directionRef.current = queuedRef.current;
      setSnake((prevSnake) => {
        const currentDirection = directionRef.current;
        const head = prevSnake[0];
        const nextHead = getNextHead(head, currentDirection);

        if (
          nextHead.x < 0 ||
          nextHead.y < 0 ||
          nextHead.x >= BOARD_SIZE ||
          nextHead.y >= BOARD_SIZE ||
          prevSnake.some((segment) => segment.x === nextHead.x && segment.y === nextHead.y)
        ) {
          stopLoop();
          setGameState("over");
          updateHighScore(scoreRef.current);
          return prevSnake;
        }

        const hasEaten = nextHead.x === food.x && nextHead.y === food.y;
        const newSnake = [nextHead, ...prevSnake];
        if (!hasEaten) {
          newSnake.pop();
        }

        if (hasEaten) {
          const newFood = randomFoodPosition(newSnake);
          setFood(newFood);
          setScore((prev) => {
            const nextScore = prev + 10;
            scoreRef.current = nextScore;
            return nextScore;
          });
          setSpeedLevel((prev) => Math.min(prev + 1, 12));
        }

        return newSnake;
      });
    }, tickRate);
  }, [food.x, food.y, stopLoop, tickRate, updateHighScore]);

  useEffect(() => {
    if (gameState === "running") {
      startLoop();
    } else {
      stopLoop();
    }

    gameStateRef.current = gameState;

    return () => {
      stopLoop();
    };
  }, [gameState, startLoop, stopLoop]);

  useEffect(() => {
    directionRef.current = direction;
  }, [direction]);

  useEffect(() => {
    queuedRef.current = queuedDirection;
  }, [queuedDirection]);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const keyMap: Record<string, Direction> = {
        ArrowUp: "UP",
        KeyW: "UP",
        ArrowDown: "DOWN",
        KeyS: "DOWN",
        ArrowLeft: "LEFT",
        KeyA: "LEFT",
        ArrowRight: "RIGHT",
        KeyD: "RIGHT"
      };

      const key = event.code;
      if (!(key in keyMap)) {
        if (key === "Space") {
          event.preventDefault();
          setGameState((state) => {
            if (state === "running") return "paused";
            if (state === "paused") return "running";
            if (state === "idle" || state === "over") {
              resetGame();
              return "running";
            }
            return state;
          });
        }
        return;
      }

      event.preventDefault();
      const nextDirection = keyMap[key];
      setQueuedDirection((currentQueued) => {
        const currentDirection = directionRef.current;
        if (isOppositeDirection(currentDirection, nextDirection)) {
          return currentQueued;
        }
        if (currentQueued === nextDirection) {
          return currentQueued;
        }
        setDirection(nextDirection);
        return nextDirection;
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [resetGame]);

  const togglePause = useCallback(() => {
    setGameState((state) => {
      if (state === "running") return "paused";
      if (state === "paused") return "running";
      if (state === "idle") {
        resetGame();
        return "running";
      }
      if (state === "over") {
        resetGame();
        return "running";
      }
      return state;
    });
  }, [resetGame]);

  const changeDirection = useCallback(
    (next: Direction) => {
      setQueuedDirection((currentQueued) => {
        const currentDirection = directionRef.current;
        if (isOppositeDirection(currentDirection, next) || currentQueued === next) {
          return currentQueued;
        }
        setDirection(next);
        return next;
      });
    },
    []
  );

  const statusLabel = useMemo(() => {
    switch (gameState) {
      case "idle":
        return "Press Space or Tap Start to Play";
      case "running":
        return "Game in Progress";
      case "paused":
        return "Paused";
      case "over":
        return "Game Over";
      default:
        return "";
    }
  }, [gameState]);

  useEffect(() => {
    updateHighScore(score);
  }, [score, updateHighScore]);

  return (
    <main>
      <div className="hud">
        <div className="hud-card">
          <h1>Neon Snake</h1>
          <p>
            Glide through the neon grid, eat glowing orbs, and grow the longest snake you can.
            Use arrow keys, WASD, or the touch controls below. Space pauses the action.
          </p>
          <div className="game-info">
            <div className="badge">Score: {score}</div>
            <div className="badge">High Score: {highScore}</div>
            <div className="badge">Speed: {1 + speedLevel}</div>
          </div>
          <button
            type="button"
            onClick={togglePause}
            style={{
              marginTop: "0.5rem",
              padding: "0.6rem 1.4rem",
              borderRadius: "999px",
              border: "1px solid rgba(56, 189, 248, 0.4)",
              background: "rgba(37, 99, 235, 0.25)",
              color: "var(--text)",
              fontSize: "1rem",
              cursor: "pointer",
              transition: "transform 0.1s ease"
            }}
          >
            {gameState === "running" ? "Pause" : gameState === "paused" ? "Resume" : "Start"}
          </button>
          <span style={{ color: "var(--accent)", fontSize: "0.95rem" }}>{statusLabel}</span>
        </div>
        <div className="controls" role="group" aria-label="Directional Controls">
          <span />
          <button type="button" onClick={() => changeDirection("UP")} aria-label="Up">
            ↑
          </button>
          <span />
          <button type="button" onClick={() => changeDirection("LEFT")} aria-label="Left">
            ←
          </button>
          <button type="button" onClick={() => changeDirection("DOWN")} aria-label="Down">
            ↓
          </button>
          <button type="button" onClick={() => changeDirection("RIGHT")} aria-label="Right">
            →
          </button>
        </div>
      </div>
      <div className="board" role="presentation">
        {snake.map((segment, index) => (
          <div
            key={`snake-${segment.x}-${segment.y}-${index}`}
            className={`tile ${index === 0 ? "snake-head" : "snake-segment"}`}
            style={{
              transform: `translate(${(segment.x * 100) / BOARD_SIZE}%, ${(segment.y * 100) / BOARD_SIZE}%)`
            }}
          />
        ))}
        <div
          className="tile food"
          style={{
            transform: `translate(${(food.x * 100) / BOARD_SIZE}%, ${(food.y * 100) / BOARD_SIZE}%)`
          }}
        />
        {gameState === "over" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(15, 23, 42, 0.72)",
              backdropFilter: "blur(2px)",
              color: "var(--text)",
              fontSize: "1.6rem",
              letterSpacing: "0.02em",
              textTransform: "uppercase"
            }}
          >
            Tap Start to Try Again
          </div>
        )}
      </div>
    </main>
  );
}
