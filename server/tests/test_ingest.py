"""
Tests for helpers/ingestRepo.py

Pure utility functions are tested directly.
ingest_repo logic is tested by patching all external I/O (MongoDB,
GitHub API, OpenAI) so no real services are required.
"""

import pytest
from unittest.mock import MagicMock, patch, call
from langchain_core.documents import Document


# ---------------------------------------------------------------------------
# Utility functions — no mocking needed
# ---------------------------------------------------------------------------

from helpers.ingestRepo import hash_text, is_supported, gh_headers


class TestHashText:
    def test_deterministic(self):
        assert hash_text("hello") == hash_text("hello")

    def test_different_inputs_differ(self):
        assert hash_text("foo") != hash_text("bar")

    def test_returns_hex_string(self):
        result = hash_text("test")
        assert isinstance(result, str)
        int(result, 16)  # raises if not valid hex


class TestIsSupported:
    @pytest.mark.parametrize("path", [
        "README.md", "main.py", "index.js", "App.ts", "notes.txt", "package.json",
    ])
    def test_supported_extensions(self, path):
        assert is_supported(path) is True

    @pytest.mark.parametrize("path", [
        "image.png", "data.csv", "archive.zip", "binary.exe", "style.css",
    ])
    def test_unsupported_extensions(self, path):
        assert is_supported(path) is False

    def test_nested_path(self):
        assert is_supported("src/components/App.tsx") is True

    def test_no_extension(self):
        assert is_supported("Makefile") is False


class TestGhHeaders:
    def test_contains_authorization(self):
        headers = gh_headers("mytoken")
        assert headers["Authorization"] == "token mytoken"

    def test_contains_accept(self):
        headers = gh_headers("mytoken")
        assert "application/vnd.github" in headers["Accept"]


# ---------------------------------------------------------------------------
# ingest_repo logic — all external I/O is patched
# ---------------------------------------------------------------------------

PATCH_BASE = "helpers.ingestRepo"


@pytest.fixture
def mock_collections():
    with (
        patch(f"{PATCH_BASE}.users_collection") as users,
        patch(f"{PATCH_BASE}.repos_collection") as repos,
        patch(f"{PATCH_BASE}.vectors_collection") as vectors,
    ):
        yield {"users": users, "repos": repos, "vectors": vectors}


@pytest.fixture
def mock_github_api():
    with patch(f"{PATCH_BASE}.http_requests") as mock_http:
        yield mock_http


@pytest.fixture
def mock_openai():
    with patch(f"{PATCH_BASE}.openai_client") as mock_client:
        embedding_response = MagicMock()
        embedding_response.data = [MagicMock(embedding=[0.1] * 10)]
        mock_client.embeddings.create.return_value = embedding_response
        yield mock_client


def _sha_response(sha: str):
    resp = MagicMock()
    resp.raise_for_status = MagicMock()
    resp.json.return_value = {"sha": sha}
    return resp


def _compare_response(files: list):
    resp = MagicMock()
    resp.raise_for_status = MagicMock()
    resp.json.return_value = {"files": files}
    return resp


class TestIngestRepo:
    def test_user_not_found_returns_error(self, mock_collections, mock_github_api):
        mock_collections["users"].find_one.return_value = None
        mock_github_api.get.return_value = _sha_response("abc123")

        from helpers.ingestRepo import ingest_repo
        result = ingest_repo("user1", "owner/repo", "ghtoken")

        assert result["status"] == "error"
        assert "User does not exist" in result["message"]

    def test_already_up_to_date_skips_ingest(self, mock_collections, mock_github_api):
        mock_collections["users"].find_one.return_value = {"github_id": "user1"}
        mock_collections["repos"].find_one.return_value = {"last_commit_sha": "abc123"}
        mock_github_api.get.return_value = _sha_response("abc123")

        from helpers.ingestRepo import ingest_repo
        result = ingest_repo("user1", "owner/repo", "ghtoken")

        assert result["status"] == "success"
        assert result["updated_chunks"] == 0
        assert "up to date" in result["message"]

    def test_incremental_no_supported_changes(self, mock_collections, mock_github_api):
        mock_collections["users"].find_one.return_value = {"github_id": "user1"}
        mock_collections["repos"].find_one.return_value = {"last_commit_sha": "old_sha"}

        # HEAD is a new SHA
        mock_github_api.get.side_effect = [
            _sha_response("new_sha"),
            _compare_response([{"filename": "image.png", "status": "modified"}]),
        ]

        from helpers.ingestRepo import ingest_repo
        result = ingest_repo("user1", "owner/repo", "ghtoken")

        assert result["status"] == "success"
        assert result["updated_chunks"] == 0
        assert "No supported file changes" in result["message"]
        mock_collections["repos"].update_one.assert_called_once()

    def test_incremental_removed_file_deletes_vectors(
        self, mock_collections, mock_github_api, mock_openai
    ):
        mock_collections["users"].find_one.return_value = {"github_id": "user1"}
        mock_collections["repos"].find_one.return_value = {"last_commit_sha": "old_sha"}
        mock_collections["vectors"].count_documents.return_value = 0
        mock_collections["vectors"].bulk_write.return_value = MagicMock(
            upserted_count=0, modified_count=0
        )

        mock_github_api.get.side_effect = [
            _sha_response("new_sha"),
            _compare_response([{"filename": "main.py", "status": "removed"}]),
        ]

        from helpers.ingestRepo import ingest_repo
        ingest_repo("user1", "owner/repo", "ghtoken")

        mock_collections["vectors"].delete_many.assert_called_once()
        delete_filter = mock_collections["vectors"].delete_many.call_args[0][0]
        assert "main.py" in delete_filter["source"]["$in"]

    def test_incremental_renamed_file_deletes_old_path(
        self, mock_collections, mock_github_api, mock_openai
    ):
        mock_collections["users"].find_one.return_value = {"github_id": "user1"}
        mock_collections["repos"].find_one.return_value = {"last_commit_sha": "old_sha"}
        mock_collections["vectors"].count_documents.return_value = 1
        mock_collections["vectors"].bulk_write.return_value = MagicMock(
            upserted_count=1, modified_count=0
        )

        mock_github_api.get.side_effect = [
            _sha_response("new_sha"),
            _compare_response([{
                "filename": "new_name.py",
                "previous_filename": "old_name.py",
                "status": "renamed",
            }]),
            # fetch_file_content call
            MagicMock(ok=True, json=MagicMock(return_value={
                "encoding": "base64",
                "content": __import__("base64").b64encode(b"print('hi')").decode(),
            })),
        ]

        from helpers.ingestRepo import ingest_repo
        ingest_repo("user1", "owner/repo", "ghtoken")

        delete_filter = mock_collections["vectors"].delete_many.call_args[0][0]
        assert "old_name.py" in delete_filter["source"]["$in"]
        assert "new_name.py" in delete_filter["source"]["$in"]

    def test_failed_commit_sha_fetch_returns_error(self, mock_collections, mock_github_api):
        mock_collections["users"].find_one.return_value = {"github_id": "user1"}
        mock_github_api.get.return_value = MagicMock(
            raise_for_status=MagicMock(side_effect=Exception("API error"))
        )

        from helpers.ingestRepo import ingest_repo
        result = ingest_repo("user1", "owner/repo", "ghtoken")

        assert result["status"] == "error"
        assert "Failed to get latest commit" in result["message"]
