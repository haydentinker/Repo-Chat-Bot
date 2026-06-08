import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import AuthProvider, { useAuth } from "../providers/AuthProvider";

function TestConsumer() {
  const { user, loading } = useAuth();
  if (loading) return <div>loading</div>;
  if (!user) return <div>no user</div>;
  return <div>hello {user.username}</div>;
}

function setup(fetchImpl: () => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(fetchImpl));
  return render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AuthProvider", () => {
  it("shows loading state initially", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {}))
    );
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("sets user when /me returns 200", async () => {
    setup(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            github_id: "42",
            username: "octocat",
            email: null,
            authenticated: true,
          }),
          { status: 200 }
        )
      )
    );

    await waitFor(() =>
      expect(screen.getByText("hello octocat")).toBeInTheDocument()
    );
  });

  it("sets user to null when /me returns 401", async () => {
    setup(() =>
      Promise.resolve(new Response(JSON.stringify({ error: "unauth" }), { status: 401 }))
    );

    await waitFor(() =>
      expect(screen.getByText("no user")).toBeInTheDocument()
    );
  });

  it("sets user to null when fetch rejects (network error)", async () => {
    setup(() => Promise.reject(new Error("Network error")));

    await waitFor(() =>
      expect(screen.getByText("no user")).toBeInTheDocument()
    );
  });

  it("fetches /me with credentials included", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({}), { status: 401 }))
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const lastCall = fetchMock.mock.lastCall as unknown as [string, RequestInit];
    expect(lastCall[1]).toMatchObject({ credentials: "include" });
  });
});
