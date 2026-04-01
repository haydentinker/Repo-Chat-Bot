"""
Tests for Flask API routes in app.py.

MongoDB collections and flask-login's current_user are patched so no
real services are needed.
"""

import pytest
from unittest.mock import MagicMock, patch
from bson import ObjectId


# ---------------------------------------------------------------------------
# App fixture — creates a test client with a fresh app context
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def client():
    with patch("helpers.ingestRepo.repos_collection"):
        import app as flask_app

    flask_app.app.config["TESTING"] = True
    flask_app.app.config["WTF_CSRF_ENABLED"] = False

    with flask_app.app.test_client() as c:
        yield c, flask_app


def _mock_user(github_id="user1", username="testuser"):
    user = MagicMock()
    user.is_authenticated = True
    user.github_id = github_id
    user.username = username
    user.email = "test@example.com"
    return user


# ---------------------------------------------------------------------------
# /me
# ---------------------------------------------------------------------------

class TestMe:
    def test_unauthenticated_returns_401(self, client):
        c, app_module = client
        with patch("app.current_user") as mock_cu:
            mock_cu.is_authenticated = False
            resp = c.get("/me")
        assert resp.status_code == 401
        assert resp.get_json()["authenticated"] is False

    def test_authenticated_returns_user(self, client):
        c, app_module = client
        user = _mock_user()
        with patch("app.current_user", user):
            resp = c.get("/me")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["github_id"] == "user1"
        assert data["username"] == "testuser"
        assert data["authenticated"] is True


# ---------------------------------------------------------------------------
# /ingest
# ---------------------------------------------------------------------------

class TestIngest:
    def test_missing_body_returns_400(self, client):
        c, app_module = client
        user = _mock_user()
        with patch("app.current_user", user):
            resp = c.post("/ingest", content_type="application/json", data="{}")
        assert resp.status_code == 400
        assert resp.get_json()["status"] == "error"

    def test_missing_repo_name_returns_400(self, client):
        c, app_module = client
        user = _mock_user()
        with patch("app.current_user", user):
            resp = c.post(
                "/ingest",
                json={"other_field": "value"},
                content_type="application/json",
            )
        assert resp.status_code == 400

    def test_valid_request_calls_ingest(self, client):
        c, app_module = client
        user = _mock_user()
        mock_result = {"status": "success", "repo_name": "owner/repo", "updated_chunks": 5}

        with (
            patch("app.current_user", user),
            patch("app.github") as mock_gh,
            patch("app.ingest_repo", return_value=mock_result) as mock_ingest,
        ):
            mock_gh.token = {"access_token": "ghtoken"}
            resp = c.post("/ingest", json={"repo_name": "owner/repo"})

        assert resp.status_code == 200
        mock_ingest.assert_called_once_with("user1", "owner/repo", "ghtoken")


# ---------------------------------------------------------------------------
# /user/loaded/repos
# ---------------------------------------------------------------------------

class TestUserLoadedRepos:
    def test_returns_repos_list(self, client):
        c, app_module = client
        user = _mock_user()
        mock_docs = [
            {"repo_name": "owner/repo1", "branch": "main", "chunk_count": 10},
            {"repo_name": "owner/repo2", "branch": "main", "chunk_count": 5},
        ]

        with (
            patch("app.current_user", user),
            patch("app.repos_collection") as mock_repos,
        ):
            mock_repos.find.return_value = iter(mock_docs)
            resp = c.get("/user/loaded/repos")

        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) == 2
        assert data[0]["repo_name"] == "owner/repo1"


# ---------------------------------------------------------------------------
# /logout
# ---------------------------------------------------------------------------

class TestLogout:
    def test_logout_calls_logout_user(self, client):
        c, app_module = client
        user = _mock_user()

        with (
            patch("app.current_user", user),
            patch("app.logout_user") as mock_logout,
        ):
            resp = c.get("/logout")

        assert resp.status_code == 200
        mock_logout.assert_called_once()
