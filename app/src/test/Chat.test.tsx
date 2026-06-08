import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, act } from "@testing-library/react";
import { Socket } from "socket.io-client";
import Chat from "../components/Chat";
import { renderWithMantine } from "./utils";

function mockSocket(): Partial<Socket> {
  return {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  };
}

describe("Chat", () => {
  let socket: ReturnType<typeof mockSocket>;

  beforeEach(() => {
    socket = mockSocket();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("renders the empty state with the repo name", () => {
    renderWithMantine(
      <Chat socket={socket as Socket} selectedThread="" selectedRepo="owner/my-repo" />
    );
    expect(screen.getByText(/owner\/my-repo/i)).toBeInTheDocument();
  });

  it("shows input placeholder with repo name", () => {
    renderWithMantine(
      <Chat socket={socket as Socket} selectedThread="" selectedRepo="owner/my-repo" />
    );
    expect(
      screen.getByPlaceholderText(/Message owner\/my-repo/i)
    ).toBeInTheDocument();
  });

  it("adds user message to the list on send", () => {
    renderWithMantine(
      <Chat socket={socket as Socket} selectedThread="" selectedRepo="owner/repo" />
    );
    const input = screen.getByPlaceholderText(/Message/i);
    fireEvent.change(input, { target: { value: "What does this repo do?" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText("What does this repo do?")).toBeInTheDocument();
  });

  it("does not emit to socket when input is empty", () => {
    renderWithMantine(
      <Chat socket={socket as Socket} selectedThread="" selectedRepo="owner/repo" />
    );
    const button = screen.getByRole("button", { name: /send/i });
    fireEvent.click(button);
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it("emits message event to socket in normal mode", () => {
    renderWithMantine(
      <Chat socket={socket as Socket} selectedThread="" selectedRepo="owner/repo" />
    );
    const input = screen.getByPlaceholderText(/Message/i);
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(socket.emit).toHaveBeenCalledWith(
      "message",
      expect.objectContaining({ message: "Hello", repo_name: "owner/repo" })
    );
  });

  it("disables input and button while waiting", () => {
    renderWithMantine(
      <Chat socket={socket as Socket} selectedThread="" selectedRepo="owner/repo" />
    );
    const input = screen.getByPlaceholderText(/Message/i);
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(input).toBeDisabled();
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
  });

  describe("mock mode", () => {
    it("does NOT emit to socket when mock mode is on", async () => {
      renderWithMantine(
        <Chat socket={socket as Socket} selectedThread="" selectedRepo="owner/repo" />
      );

      fireEvent.click(screen.getByRole("switch"));

      const input = screen.getByPlaceholderText(/Message/i);
      fireEvent.change(input, { target: { value: "test" } });
      fireEvent.click(screen.getByRole("button", { name: /send/i }));

      expect(socket.emit).not.toHaveBeenCalled();
    });

    it("shows thinking indicator after send in mock mode", async () => {
      renderWithMantine(
        <Chat socket={socket as Socket} selectedThread="" selectedRepo="owner/repo" />
      );
      fireEvent.click(screen.getByRole("switch"));

      const input = screen.getByPlaceholderText(/Message/i);
      fireEvent.change(input, { target: { value: "hi" } });
      fireEvent.click(screen.getByRole("button", { name: /send/i }));

      expect(screen.getByText(/Thinking/i)).toBeInTheDocument();
    });

    it("produces an assistant response after the simulated delay", async () => {
      renderWithMantine(
        <Chat socket={socket as Socket} selectedThread="" selectedRepo="owner/repo" />
      );
      fireEvent.click(screen.getByRole("switch"));

      const input = screen.getByPlaceholderText(/Message/i);
      fireEvent.change(input, { target: { value: "hi" } });
      fireEvent.click(screen.getByRole("button", { name: /send/i }));

      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      const papers = document.querySelectorAll("[class*=Paper]");
      expect(papers.length).toBeGreaterThanOrEqual(2);
      const assistantText = papers[papers.length - 1].textContent ?? "";
      expect(assistantText.length).toBeGreaterThan(0);
      expect(assistantText).not.toBe("hi");
    });

    it("re-enables input after mock stream completes", async () => {
      renderWithMantine(
        <Chat socket={socket as Socket} selectedThread="" selectedRepo="owner/repo" />
      );
      fireEvent.click(screen.getByRole("switch"));

      const input = screen.getByPlaceholderText(/Message/i);
      fireEvent.change(input, { target: { value: "hi" } });
      fireEvent.click(screen.getByRole("button", { name: /send/i }));

      await act(async () => {
        vi.runAllTimers();
      });

      expect(input).not.toBeDisabled();
    });
  });
});
