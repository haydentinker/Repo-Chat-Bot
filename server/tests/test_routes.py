"""
Tests for Flask API routes in app.py.

MongoDB collections and flask-login's current_user are patched so no
real services are needed.
"""

import pytest
from unittest.mock import MagicMock, patch
from bson import ObjectId


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
    user.id = str(ObjectId())
    return user


class TestMe:
    def test_unauthenticated_returns_401(self, client):
        c, app_module = client
        with patch("app.current_user") as mock_cu:
            mock_cu.is_authenticated = False
            resp = c.get("/me")
        assert resp.status_code == 401
        data = resp.get_json()
        assert "error" in data or data.get("authenticated") is False

    def test_authenticated_returns_user(self, client):
        c, app_module = client
        user = _mock_user()
        with (
            patch("app.current_user", user),
            patch("app.users_collection") as mock_users,
        ):
            mock_users.find_one.return_value = {"plan": "free", "credits_remaining": 100}
            resp = c.get("/me")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["github_id"] == "user1"
        assert data["username"] == "testuser"
        assert data["authenticated"] is True


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

        with (
            patch("app.current_user", user),
            patch("app.github") as mock_gh,
            patch("app.repos_collection") as mock_repos,
            patch("app.users_collection") as mock_users,
            patch("app.socketio") as mock_sio,
        ):
            mock_gh.token = {"access_token": "ghtoken"}
            mock_repos.find_one.return_value = None
            mock_repos.count_documents.return_value = 0
            mock_users.find_one.return_value = {"plan": "free"}
            mock_sio.start_background_task = MagicMock()
            resp = c.post("/ingest", json={"repo_name": "owner/repo"})

        assert resp.status_code == 200
        assert resp.get_json()["status"] == "queued"
        mock_sio.start_background_task.assert_called_once()


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


class TestLogout:
    def test_logout_calls_logout_user(self, client):
        c, app_module = client
        user = _mock_user()

        with (
            patch("app.current_user", user),
            patch("flask_login.utils._get_user", return_value=user),
            patch("app.logout_user") as mock_logout,
        ):
            resp = c.get("/logout")

        assert resp.status_code == 200
        mock_logout.assert_called_once()


class TestUserThreads:
    def _make_threads(self, n: int):
        from datetime import datetime, UTC
        return [
            {
                "session_id": f"sess-{i}",
                "repo_name": "owner/repo",
                "name": f"Thread {i}",
                "last_updated": datetime.now(UTC).isoformat(),
                "created_at": datetime.now(UTC).isoformat(),
            }
            for i in range(n)
        ]

    def test_missing_repo_name_returns_400(self, client):
        c, app_module = client
        user = _mock_user()
        with patch("app.current_user", user):
            resp = c.get("/user/threads")
        assert resp.status_code == 400
        assert "repo_name" in resp.get_json()["error"]

    def test_returns_paginated_structure(self, client):
        c, app_module = client
        user = _mock_user()
        threads = self._make_threads(5)

        with (
            patch("app.current_user", user),
            patch("app.thread_collection") as mock_col,
        ):
            mock_col.count_documents.return_value = 5
            mock_col.find.return_value.sort.return_value.skip.return_value.limit.return_value = iter(threads)
            resp = c.get("/user/threads?repo_name=owner/repo")

        assert resp.status_code == 200
        data = resp.get_json()
        assert "threads" in data
        assert "total" in data
        assert "page" in data
        assert "limit" in data
        assert data["total"] == 5
        assert data["page"] == 1

    def test_page_2_skips_correctly(self, client):
        c, app_module = client
        user = _mock_user()

        with (
            patch("app.current_user", user),
            patch("app.thread_collection") as mock_col,
        ):
            mock_col.count_documents.return_value = 25
            mock_col.find.return_value.sort.return_value.skip.return_value.limit.return_value = iter([])
            c.get("/user/threads?repo_name=owner/repo&page=2&limit=10")
            mock_col.find.return_value.sort.return_value.skip.assert_called_with(10)

    def test_invalid_page_returns_400(self, client):
        c, app_module = client
        user = _mock_user()
        with patch("app.current_user", user):
            resp = c.get("/user/threads?repo_name=owner/repo&page=notanumber")
        assert resp.status_code == 400

    def test_limit_capped_at_50(self, client):
        c, app_module = client
        user = _mock_user()

        with (
            patch("app.current_user", user),
            patch("app.thread_collection") as mock_col,
        ):
            mock_col.count_documents.return_value = 0
            mock_col.find.return_value.sort.return_value.skip.return_value.limit.return_value = iter([])
            c.get("/user/threads?repo_name=owner/repo&limit=999")
            mock_col.find.return_value.sort.return_value.skip.return_value.limit.assert_called_with(50)


class TestActivatePlan:
    def test_free_plan_activates(self, client):
        c, app_module = client
        user = _mock_user()
        with (
            patch("app.current_user", user),
            patch("app.users_collection") as mock_users,
        ):
            mock_users.find_one.return_value = {"plan": "free", "credits_remaining": app_module.FREE_PLAN_CREDITS}
            resp = c.post("/user/plan/activate", json={"plan": "free"})

        assert resp.status_code == 200
        update = mock_users.update_one.call_args[0][1]["$set"]
        assert update["plan"] == "free"
        assert update["credits_remaining"] == app_module.FREE_PLAN_CREDITS

    def test_pro_plan_rejected(self, client):
        c, app_module = client
        user = _mock_user()
        with (
            patch("app.current_user", user),
            patch("app.users_collection") as mock_users,
        ):
            resp = c.post("/user/plan/activate", json={"plan": "pro"})

        assert resp.status_code == 400
        mock_users.update_one.assert_not_called()

    def test_team_plan_rejected(self, client):
        c, app_module = client
        user = _mock_user()
        with (
            patch("app.current_user", user),
            patch("app.users_collection") as mock_users,
        ):
            resp = c.post("/user/plan/activate", json={"plan": "team"})

        assert resp.status_code == 400
        mock_users.update_one.assert_not_called()

    def test_missing_plan_rejected(self, client):
        c, app_module = client
        user = _mock_user()
        with (
            patch("app.current_user", user),
            patch("app.users_collection") as mock_users,
        ):
            resp = c.post("/user/plan/activate", json={})

        assert resp.status_code == 400
        mock_users.update_one.assert_not_called()


def _stripe_event(event_type, obj):
    event = MagicMock()
    event.type = event_type
    event.data.object = obj
    return event


class TestStripeWebhook:
    def test_checkout_completed_upgrades_user(self, client):
        c, app_module = client
        obj = MagicMock()
        obj.payment_status = "paid"
        obj.metadata = {"github_id": "user1"}
        obj.customer = "cus_123"
        obj.subscription = "sub_123"
        event = _stripe_event("checkout.session.completed", obj)

        with (
            patch("app.STRIPE_WEBHOOK_SECRET", "whsec_test"),
            patch("app.stripe.Webhook.construct_event", return_value=event),
            patch("app.users_collection") as mock_users,
        ):
            resp = c.post("/stripe/webhook", data="{}", headers={"Stripe-Signature": "sig"})

        assert resp.status_code == 200
        filt, update = mock_users.update_one.call_args[0]
        assert filt == {"github_id": "user1"}
        assert update["$set"]["plan"] == "pro"
        assert update["$set"]["credits_remaining"] == -1
        assert update["$set"]["stripe_customer_id"] == "cus_123"

    def test_unpaid_checkout_does_not_upgrade(self, client):
        c, app_module = client
        obj = MagicMock()
        obj.payment_status = "unpaid"
        obj.metadata = {"github_id": "user1"}
        event = _stripe_event("checkout.session.completed", obj)

        with (
            patch("app.STRIPE_WEBHOOK_SECRET", "whsec_test"),
            patch("app.stripe.Webhook.construct_event", return_value=event),
            patch("app.users_collection") as mock_users,
        ):
            resp = c.post("/stripe/webhook", data="{}", headers={"Stripe-Signature": "sig"})

        assert resp.status_code == 200
        mock_users.update_one.assert_not_called()

    def test_subscription_deleted_downgrades_user(self, client):
        c, app_module = client
        obj = MagicMock()
        obj.customer = "cus_123"
        event = _stripe_event("customer.subscription.deleted", obj)

        with (
            patch("app.STRIPE_WEBHOOK_SECRET", "whsec_test"),
            patch("app.stripe.Webhook.construct_event", return_value=event),
            patch("app.users_collection") as mock_users,
        ):
            resp = c.post("/stripe/webhook", data="{}", headers={"Stripe-Signature": "sig"})

        assert resp.status_code == 200
        filt, update = mock_users.update_one.call_args[0]
        assert filt == {"stripe_customer_id": "cus_123"}
        assert update["$set"]["plan"] == "free"
        assert update["$set"]["credits_remaining"] == app_module.FREE_PLAN_CREDITS

    def test_missing_secret_returns_500(self, client):
        c, app_module = client
        with patch("app.STRIPE_WEBHOOK_SECRET", ""):
            resp = c.post("/stripe/webhook", data="{}", headers={"Stripe-Signature": "sig"})
        assert resp.status_code == 500

    def test_invalid_payload_returns_400(self, client):
        c, app_module = client
        with (
            patch("app.STRIPE_WEBHOOK_SECRET", "whsec_test"),
            patch("app.stripe.Webhook.construct_event", side_effect=ValueError("bad payload")),
        ):
            resp = c.post("/stripe/webhook", data="not-json", headers={"Stripe-Signature": "sig"})
        assert resp.status_code == 400
