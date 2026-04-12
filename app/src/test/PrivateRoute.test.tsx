import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import PrivateRoute from "../components/PrivateRoute";
import * as AuthProviderModule from "../providers/AuthProvider";

vi.mock("../providers/AuthProvider", async (importOriginal) => {
  const mod = await importOriginal<typeof AuthProviderModule>();
  return { ...mod, useAuth: vi.fn() };
});

const mockUseAuth = vi.mocked(AuthProviderModule.useAuth);

afterEach(() => {
  vi.clearAllMocks();
});

describe("PrivateRoute", () => {
  it("shows loading indicator while auth is resolving", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true, refreshUser: vi.fn() });
    render(
      <PrivateRoute>
        <div>protected content</div>
      </PrivateRoute>
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("protected content")).not.toBeInTheDocument();
  });

  it("renders children when user is authenticated", () => {
    mockUseAuth.mockReturnValue({
      user: {
        github_id: "42",
        username: "octocat",
        email: null,
        authenticated: true,
        plan: "free",
        credits_remaining: 100,
      },
      loading: false,
      refreshUser: vi.fn(),
    });

    render(
      <PrivateRoute>
        <div>protected content</div>
      </PrivateRoute>
    );
    expect(screen.getByText("protected content")).toBeInTheDocument();
  });

  it("redirects to GitHub auth when user is null", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, refreshUser: vi.fn() });

    const assignMock = vi.fn();
    Object.defineProperty(window, "location", {
      value: { href: "" },
      writable: true,
    });
    Object.defineProperty(window.location, "href", {
      set: assignMock,
      get: () => "",
      configurable: true,
    });

    render(
      <PrivateRoute>
        <div>protected content</div>
      </PrivateRoute>
    );

    expect(assignMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/github")
    );
    expect(screen.queryByText("protected content")).not.toBeInTheDocument();
  });
});
