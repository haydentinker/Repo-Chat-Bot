"""
E2E tests for SocketIO message handling in app.py.

Uses flask-socketio's built-in test client which runs events
synchronously — no real network or background threads involved.
"""

import pytest
from unittest.mock import MagicMock, patch
from bson import ObjectId


@pytest.fixture(scope="module")
def flask_app():
    with patch("helpers.ingestRepo.repos_collection"):
        import app as _app

    _app.app.config["TESTING"] = True
    return _app


def _mock_user(github_id="user1"):
    user = MagicMock()
    user.is_authenticated = True
    user.github_id = github_id
    user.id = str(ObjectId())
    return user


def _make_socket_client(flask_app, user):
    """Return a connected test client with current_user patched."""
    with patch("app.current_user", user):
        client = flask_app.socketio.test_client(flask_app.app)
    return client


class TestSocketValidation:
    def test_missing_message_emits_error(self, flask_app):
        user = _mock_user()
        with patch("app.current_user", user):
            client = flask_app.socketio.test_client(flask_app.app)
            client.emit("message", {"message": "", "repo_name": "owner/repo"})
            received = client.get_received()

        error_events = [e for e in received if e["name"] == "response"]
        assert error_events, "Expected a 'response' error event"
        assert "error" in error_events[0]["args"][0]

    def test_missing_repo_name_emits_error(self, flask_app):
        user = _mock_user()
        with patch("app.current_user", user):
            client = flask_app.socketio.test_client(flask_app.app)
            client.emit("message", {"message": "hello", "repo_name": ""})
            received = client.get_received()

        error_events = [e for e in received if e["name"] == "response"]
        assert error_events, "Expected a 'response' error event"
        assert "error" in error_events[0]["args"][0]

    def test_both_missing_emits_error(self, flask_app):
        user = _mock_user()
        with patch("app.current_user", user):
            client = flask_app.socketio.test_client(flask_app.app)
            client.emit("message", {})
            received = client.get_received()

        error_events = [e for e in received if e["name"] == "response"]
        assert error_events


class TestSocketNewThread:
    def test_new_thread_inserted_into_db(self, flask_app):
        user = _mock_user()
        mock_history = MagicMock()
        mock_history.messages = []

        with (
            patch("app.current_user", user),
            patch("app.thread_collection") as mock_threads,
            patch("app.users_collection") as mock_users,
            patch("app.repos_collection") as mock_repos,
            patch("app.get_thread_history", return_value=mock_history),
            patch("app.baseAgent") as mock_agent,
        ):
            mock_users.find_one.return_value = {"plan": "free", "credits_remaining": 100}
            mock_repos.find_one.return_value = {}
            mock_agent.invoke.return_value = {"messages": []}
            client = flask_app.socketio.test_client(flask_app.app)
            client.emit("message", {
                "message": "What does this repo do?",
                "repo_name": "owner/repo",
            })
            import eventlet
            eventlet.sleep(0.05)

        mock_threads.insert_one.assert_called_once()
        insert_doc = mock_threads.insert_one.call_args[0][0]
        assert insert_doc["repo_name"] == "owner/repo"
        assert insert_doc["name"] == "What does this repo do?"
        assert insert_doc["github_id"] == "user1"

    def test_existing_thread_updates_last_updated(self, flask_app):
        user = _mock_user()
        existing_session = str(ObjectId())
        mock_history = MagicMock()
        mock_history.messages = []

        with (
            patch("app.current_user", user),
            patch("app.thread_collection") as mock_threads,
            patch("app.users_collection") as mock_users,
            patch("app.repos_collection") as mock_repos,
            patch("app.get_thread_history", return_value=mock_history),
            patch("app.baseAgent") as mock_agent,
        ):
            mock_users.find_one.return_value = {"plan": "free", "credits_remaining": 100}
            mock_repos.find_one.return_value = {}
            mock_agent.invoke.return_value = {"messages": []}
            client = flask_app.socketio.test_client(flask_app.app)
            client.emit("message", {
                "message": "Follow-up question",
                "repo_name": "owner/repo",
                "session_id": existing_session,
            })
            import eventlet
            eventlet.sleep(0.05)

        mock_threads.update_one.assert_called_once()
        mock_threads.insert_one.assert_not_called()


class TestCacheNamespace:
    def test_cache_namespace_set_per_user_and_repo(self, flask_app):
        """Verify cache_namespace is set to github_id::repo_name during stream."""
        user = _mock_user(github_id="user42")
        mock_history = MagicMock()
        mock_history.messages = []

        with (
            patch("app.current_user", user),
            patch("app.thread_collection"),
            patch("app.users_collection") as mock_users,
            patch("app.repos_collection") as mock_repos,
            patch("app.get_thread_history", return_value=mock_history),
            patch("app.baseAgent") as mock_agent,
            patch("app.cache_namespace") as mock_ns,
        ):
            mock_users.find_one.return_value = {"plan": "free", "credits_remaining": 100}
            mock_repos.find_one.return_value = {}
            mock_agent.invoke.return_value = {"messages": []}
            client = flask_app.socketio.test_client(flask_app.app)
            client.emit("message", {
                "message": "test",
                "repo_name": "owner/myrepo",
            })
            import eventlet
            eventlet.sleep(0.05)

            set_calls = [str(c.args[0]) for c in mock_ns.set.call_args_list]

        assert any("user42" in c and "owner/myrepo" in c for c in set_calls), (
            f"Expected cache_namespace.set() called with user42::owner/myrepo, got: {set_calls}"
        )
